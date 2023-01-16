import {addEvent} from './event.js';

/**
 * @param {Object} vdom 虚拟DOM
 * @param {Object} container 虚拟dom生成真实dom元素后要插入的容器
 */
function render(vdom,container){
	const truthDom = createDom(vdom);
	container.appendChild(truthDom);
}

/* 
	传入函数组件的虚拟dom React元素
	它的type是function
 */
function updateFunctionComponent(vdom){
	let {type,props} = vdom;
	// 执行函数 并将props当做参数传入 供函数内部使用 执行函数会得到一个函数的JSX对象 会被编译为RC函数 并拿到返回值组件的虚拟dom
	// renderVdom可能是一个原生的虚拟dom  也可能是一个组件类型的虚拟dom 
	let renderVdom = type(props);
	// 将组件的虚拟dom传入createDom方法中生成真实dom 并挂载到容器上
	return createDom(renderVdom);
}

/*
	类组件的虚拟dom渲染为真实dom
 */
function updateClassComponent(vdom){
	let {type,props} = vdom;
	// new 类组件得到类组件的实例 这一步会将props挂载到实例classInstance的props属性上
	let classInstance = new type(props);

	// 生命周期函数componentWillMount
	if(classInstance.componentWillMount && typeof classInstance.componentWillMount === 'function'){
		classInstance.componentWillMount();
	}

	// renderVdom可能是一个原生的虚拟dom  也可能是一个组件类型的虚拟dom 
	let renderVdom = classInstance.render();
	// 在类的实例上保存真实dom 便于后续进行新旧dom的更新
	let dom = createDom(renderVdom);

	// 生命周期函数componentDidMount
	if(classInstance.componentDidMount && typeof classInstance.componentDidMount === 'function'){
		classInstance.componentDidMount();
	}


	classInstance.dom = dom;
	return dom;
}


/**
 * @param {Object} vdom 虚拟dom
 * 
 * 1.可能是一个字符串或者数字 那么直接返回文本节点即可
 * 2.可能是null或者undefined
 * 3.可能是单个React元素 也就是常见的createElement方法的返回值js对象
 */
export function createDom(vdom){
	
	if(typeof vdom === 'string' || typeof vdom === 'number'){
		return document.createTextNode(vdom);
	}
	
	if(!vdom){
		return "";
	}
	
	const {type,props,ref} = vdom;
	
	let dom;
	// type是函数 说明渲染的是函数式组件 
	/* 
		如何区分一个组件是函数组件还是类组件
		
	 */
	if(typeof type === 'function'){
		if(type.isReactComponent){
			// 类组件 type是一个类组件的虚拟dom元素
			return updateClassComponent(vdom);
		}else{
			// 函数式组件
			return updateFunctionComponent(vdom);
		}
		
	}else{
		dom = document.createElement(type); // 创建顶级元素节点
		// 将props上的属性如className、style添加到dom元素对象上
		updateProps(dom,props);
		// 处理子节点
		if(typeof props.children === 'string'|| typeof props.children === 'number'){
			dom.textContent = props.children;
		}else if(typeof props.children === 'object' && props.children.type){
			// 说明是单个React元素 递归处理
			render(props.children,dom);
		}else if(Array.isArray(props.children)){
			// 说明有多个子节点 可能是React元素 可能是null 可能是字符串或数字
			reconcileChildren(props.children,dom);
		}else{
			// 说明是意外情况 比如props.children是null或者undefined
			dom.textContent = props.children ? props.children.toString() : "";
		}
	}
	
	// 实现ref的功能 如果一个dom的虚拟dom对象上有ref属性 就将ref的current指向当前真实dom元素
	if(ref){
		ref.current = dom;
	}
	
	return dom;
	
}

/**
 * 遍历所有子节点虚拟dom全部转成真实DOM并且插入到父节点中
 * 
 * @param {Object} childrenVdomList 子节点的虚拟dom列表
 * @param {Object} parentDom 父节点dom元素对象
 */
function reconcileChildren(childrenVdomList,parentDom){
	for (var i = 0; i < childrenVdomList.length; i++) {
		let vDom = childrenVdomList[i];
		render(vDom,parentDom)
	}
}

function updateProps(dom,props){
	for (let key in props) {
		if(key === 'children') continue;
		if(key === 'style'){
			let styleObj = props[key];
			for (let styleKey in styleObj) {
				dom.style[styleKey] = styleObj[styleKey];
			}
		}else if(key.startsWith('on')){
			// 绑定合成事件
			addEvent(dom,key.toLocaleLowerCase(),props[key]);
			// dom[key.toLocaleLowerCase()] = props[key];	
		}else if(key==='className'){
			dom[key] = props[key];
		}
	}
}


const ReactDOM = {
	render
};

export default ReactDOM;