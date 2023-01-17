## React的更新机制
React内部规定，组件的数据来源于两个地方：
1. props 外界传入的
2. state 内部定义的
如果要改变组件状态，那么只能通过setState来更新而不可以直接给state进行赋值
并且每次setState都会引起组件的更新流程。


关于setState有以下规定：
1. 在生命周期函数和事件处理函数中，setState是异步更新的，也就是说会得到函数内部其他代码执行完成之后才会去执行更新，而不是执行一次setState就更新一次，是一种延迟的批量更新机制

2. setState在其他函数中比如定时器中是同步更新的，只要调用就立即进行更新

3. setState在更新时会合并属性，也就是说只修改一个key即可引起更新，而无需对整个对象进行完全修改

4. 不要直接给state对象赋值，这会报错


React内部的更新是通过Updater更新器和updateQuene来实现的，下面挨个说明。

## updateQuene：管理所有更新器的单例对象
1. 全局共享，单例模式只有一个
2. 保存所有更新器的队列
3. 内部有控制同步更新还是异步更新的isBatchingUpdate变量
4. 可以添加更新器
5. 每一个updater必须都有一个updateComponent方法用于实现组件更新
6. 可以实现批量更新batchUpdate
```js
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
```

## Updater：更新器
1. 每一个Updater类的实例的classInstance都保存了一个组件实例对象
2. 每一个类组件实例都会有一个唯一的Updater更新器实例对象
```js
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

	emitUpdate(){
		// 如果是批量更新模式 就将此updater实例存入updateQuene的队列中
		if(updateQuene.isBatchingUpdate){
			updateQuene.add(this);
		}else{
			// 否则执行同步更新组件
			this.updateComponent();
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
	
	// 组件更新方法
	updateComponent(){
		let {classInstance,pengingStates} = this;
		// 说明有等待更新的state 先判断是否需要更新
		if(pengingStates.length){
			shouldUpdate(classInstance,this.getState());
		}
		
	}
}

function shouldUpdate(classInstance,nextState){
	// 将更新后的state重新挂载到组件实例上
	classInstance.state = nextState;

	// 生命周期函数 shouldComponentUpdate
	if(classInstance.shouldComponentUpdate && typeof classInstance.shouldComponentUpdate === 'function'){
		if(!classInstance.shouldComponentUpdate(classInstance.props,nextState)){
			// 如果shouldComponentUpdate执行函数false 那么终止这次更新
			return;
		}
	}

	// 强制更新组件
	classInstance.forceUpdate();
}


```


## React.Component实现
React中的每一个类组件都继承自React.Component这个类，特点有：
1. 每一个类的实例都有一个props属性以及state属性
2. 都有一个唯一的updater更新器
3. 都有setState方法
4. 都有forceUpdate强制更新视图方法
```js
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

		// 执行实例的render方法得到新的虚拟DOM
		let renderVdom = this.render();

		// 更新视图
		updateClassComponent(this,renderVdom);
	}
	
	
}

/* 
	更新类组件的方法
*/
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
```

到这里我们总结下流程，假设updateQuene.isBatchingUpdate的值为true，当我们是事件处理函数中执行了setSatte方法时：
1. this.setState触发，传入部分参数partialState
2. 执行this.updater.addState(partialState);
3. 将这次的partialState保存到更新器Updater的pengingStates队列中
4. 然后将这个更新器实例加入到updateQuene中去重然后保存起来
5. 连续执行多次this.setState，走的都是这个路线，所以先不会执行而是等待
6. 事件处理函数执行完成之后会在内部触发updateQuene.batchUpdate表示开始批量更新
7. 遍历updaters队列然后取出每一个updater实例执行其updateComponent方法
8. 执行shouldUpdate，执行生命周期函数shouldComponentUpdate，返回false即可终止更新
9. 执行组件实例的forceUpdate方法
10. 执行生命周期函数componentWillUpdate
11. 执行render函数拿到新的renderVdom
12. 执行updateClassComponent更新组件，其实从classInstance的dom上获取到旧的dom元素，然后新旧进行替换
13. 执行生命周期函数componentDidUpdate
14. 刷新classInstance.dom等于最终的新的dom

所以可以看出，这个流程中它会先将state全部保存到一个队列中，等事件处理函数执行之后依次批量更新，也就实现了异步，但是这里缺少dom diff后面会补充。