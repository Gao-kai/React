import {createDom,compareTwoVdom} from './ReactDom.js';
/* 
	定义一个updateQuene单例模式 
	所有组件共用一个
 */
export const updateQuene = {
	// 保存更新器的数组
	updaters:new Set(),
	// 是否处于批量更新模式 默认是非批量更新 也就是同步更新
	isBatchingUpdate:false,
	// 添加一个更新器 相同的更新器需要去重 避免执行多余的forceUpdate
	add(updater){
		this.updaters.add(updater);
	},
	// 强制批量组件更新
	batchUpdate(){
		this.updaters.forEach(updater=>updater.updateComponent());
		this.isBatchingUpdate = false;
		this.updaters.clear();
	}
}


/* 
	定义一个Updater类
	每一个Updater类的实例的classInstance都保存了一个组件实例对象
 */
class Updater {
	constructor(classInstance){
		// 保存类组件的实例属性
		this.classInstance = classInstance;
		// 等待更新的状态数组
		this.pengingStates = [];
	}
	
	addState(partialState){
		// 将新的state对象或者函数存入pengingStates
		this.pengingStates.push(partialState);
		// 发射更新
		this.emitUpdate();
	}

	// 统一处理state和props引起的更新
	emitUpdate(nextProps){
		this.nextProps = nextProps;
		/* 
			如果接收到了新的属性
			或者当前处于非批量更新模式
			那么直接走组件更新 也就是同步更新模式
		*/
		if(this.nextProps || !(updateQuene.isBatchingUpdate)){
			this.updateComponent();
		}else{
			/* 
				否则走异步更新那一套
				就将此updater实例存入updateQuene的队列中
			*/
			updateQuene.add(this);
		}
	}
	
	getState(){
		let {classInstance,pengingStates} = this;
		// 更新前旧的state
		let {state} = classInstance;
		// 说明有等待更新的state
		if(pengingStates.length){
			// 取出状态依次更新
			for (var i = 0; i < pengingStates.length; i++) {
				let newState = pengingStates[i];
				if(typeof newState === 'function'){
					// 执行函数并传入旧的state 进行合并
					state = {...state,...newState(state)};
				}else{
					state = {...state,...newState};
				}
			}
		}
		pengingStates.length = 0;
		return state;
	}
	
	updateComponent(){
		let {classInstance,pengingStates,nextProps} = this;
		// 说明有等待更新的state 先判断是否需要更新 并将新的props和state传入
		if(nextProps || pengingStates.length){
			shouldUpdate(classInstance,nextProps,this.getState());
		}
		
	}
}

function shouldUpdate(classInstance,nextProps,nextState){
	// 将更新后的state和props重新挂载到组件实例上 此时实例状态会发生变化 不管之后是否更新视图
	classInstance.state = nextState;
	classInstance.props = nextProps || classInstance.props;

	// 什么周期函数 shouldComponentUpdate
	if(classInstance.shouldComponentUpdate && typeof classInstance.shouldComponentUpdate === 'function'){
		if(!classInstance.shouldComponentUpdate(classInstance.props,nextState)){
			// 如果shouldComponentUpdate执行函数false 那么终止这次更新
			return;
		}
	}

	// 强制更新组件
	classInstance.forceUpdate();
}


class Component {
	// 静态属性 会被实例继承
	static isReactComponent = true;
	
	constructor(props){
		this.props = props;
		this.state = {};
		
		// 每一个组件实例对象都有一个属性updater保存了更新器实例对象
		this.updater = new Updater(this);
	}
	
	/**
	 * @param {Object} partialState 新的部分状态
	 * 1. 先实现同步更新
	 * 2. 实现事件绑定
	 * 3. 实现异步更新
	 */
	setState(partialState){
		this.updater.addState(partialState);
	}
	
	/* 
		强制重新更新
	 */
	forceUpdate(){
		// 生命周期函数componentWillUpdate 组件即将更新
		if(this.componentWillUpdate && typeof this.componentWillUpdate === 'function'){
			this.componentWillUpdate();
		}

		// 新的生命周期函数
		if(this.ownVdom?.type?.getDerivedStateFromProps){
			let newState = this.ownVdom?.type?.getDerivedStateFromProps(this.props,this.state);
			if(newState){
				this.state = newState;
			}
		}

		// 执行实例的render方法得本次更新之后的虚拟DOM
		let newRenderVdom = this.render();

		// 从类的实例上通过oldVdom拿到旧的虚拟dom 记着：无论何时都必须保证可以通过实例的oldVdom属性拿到旧的虚拟dom
		let oldRenderVdom = this.oldVdom;

		// 拿到之前真实dom要挂载的父节点 也就是#root 在第一次挂载的时候在旧的oldVdOM上挂载了一个dom属性指向生成的真实dom
		let parentDom = this.oldVdom.dom.parentNode;

		// 在修改dom之前获取到一些更新前的dom信息 生命周期函数getSnapShotBeforeUpdate 将返回值传递给componentDidUpdate
		let extraArgs;
		if(this.getSnapShotBeforeUpdate){
			extraArgs = this.getSnapShotBeforeUpdate();
		}

		// 实现dom-diff对比 对比的过程中会完成更新 并且返回更新之后新的的虚拟dom
		let currentVdom = compareTwoVdom(oldRenderVdom,newRenderVdom,parentDom);

		// 将这一次生成的虚拟dom当做下一次更新的旧的虚拟dom 方便下一次更新
		this.oldVdom = currentVdom;

		// 生命周期函数componentDidUpdate 组件更新完毕
		if(this.componentDidUpdate && typeof this.componentDidUpdate === 'function'){
			this.componentDidUpdate(this.state,this.props,extraArgs);
		}
	}	
}



/* 不走这个暴力更新的逻辑了 */
function updateClassComponent(classInstance,renderVdom){
	// 获取旧的真实dom元素
	let oldDOM = classInstance.dom;
	// 创建新的真实dom
	let newDOM = createDom(renderVdom);
	// 更新节点
	oldDOM.parentNode.replaceChild(newDOM,oldDOM);
	// 生命周期函数componentDidUpdate 组件更新完毕
	if(classInstance.componentDidUpdate && typeof classInstance.componentDidUpdate === 'function'){
		classInstance.componentDidUpdate();
	}
	// 重新赋值
	classInstance.dom = newDOM;
}

export default Component;