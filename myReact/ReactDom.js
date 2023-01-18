import { addEvent } from "./event.js";

/**
 * @param {Object} vdom 虚拟DOM
 * @param {Object} container 虚拟dom生成真实dom元素后要插入的容器
 */
function render(vdom, container) {
  const truthDom = createDom(vdom);
  container.appendChild(truthDom);
}

/* 
	传入函数组件的虚拟dom React元素
	它的type是function
 */
function updateFunctionComponent(vdom) {
  let { type, props } = vdom;
  // 执行函数 并将props当做参数传入 供函数内部使用 执行函数会得到一个函数的JSX对象 会被编译为RC函数 并拿到返回值组件的虚拟dom
  // renderVdom可能是一个原生的虚拟dom  也可能是一个组件类型的虚拟dom
  let renderVdom = type(props);
  // 将组件的虚拟dom传入createDom方法中生成真实dom 并挂载到容器上
  return createDom(renderVdom);
}

/*
	类组件的虚拟dom渲染为真实dom
 */
function updateClassComponent(vdom) {
  let { type, props } = vdom;
  // new 类组件得到类组件的实例 这一步会将props挂载到实例classInstance的props属性上
  let classInstance = new type(props);
  // 关联
  vdom.classInstance = classInstance;
  // 挂载属性ownVdom在实例上 用于表示vdom
  classInstance.ownVdom = vdom;

  // 生命周期函数componentWillMount
  if (
    classInstance.componentWillMount &&
    typeof classInstance.componentWillMount === "function"
  ) {
    classInstance.componentWillMount();
  }

  // renderVdom可能是一个原生的虚拟dom  也可能是一个组件类型的虚拟dom
  let renderVdom = classInstance.render();

  // 在类的实例上保存真实dom 便于后续进行新旧dom的更新
  let dom = createDom(renderVdom);

  // 让组件的vdom的dom属性和render方法返回的renderVdom的dom属性都指向真实dom
  vdom.dom = renderVdom.dom = dom;

  // 让组件实例的老的虚拟dom指向本次render出来的虚拟dom
  classInstance.oldVdom = renderVdom;

  // 生命周期函数componentDidMount
  if (
    classInstance.componentDidMount &&
    typeof classInstance.componentDidMount === "function"
  ) {
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
export function createDom(vdom) {
  if (typeof vdom === "string" || typeof vdom === "number") {
    return document.createTextNode(vdom);
  }

  if (!vdom) {
    return "";
  }

  const { type, props, ref } = vdom;

  let dom;
  /* 
		如何区分一个组件是函数组件还是类组件
	 */
  if (typeof type === "function") {
    if (type.isReactComponent) {
      // 类组件 type是一个类组件的虚拟dom元素
      return updateClassComponent(vdom);
    } else {
      // 函数式组件
      // console.log("vdom", vdom);
      return updateFunctionComponent(vdom);
    }
  } else {
    dom = document.createElement(type); // 创建顶级元素节点
    // 将props上的属性如className、style添加到dom元素对象上
    updateProps(dom, {}, props);
    // 处理子节点
    if (
      typeof props.children === "string" ||
      typeof props.children === "number"
    ) {
      dom.textContent = props.children;
    } else if (typeof props.children === "object" && props.children.type) {
      // 说明是单个React元素 递归处理
      render(props.children, dom);
    } else if (Array.isArray(props.children)) {
      // 说明有多个子节点 可能是React元素 可能是null 可能是字符串或数字
      reconcileChildren(props.children, dom);
    } else {
      // 说明是意外情况 比如props.children是null或者undefined
      dom.textContent = props.children ? props.children.toString() : "";
    }
  }

  // 实现ref的功能 如果一个dom的虚拟dom对象上有ref属性 就将ref的current指向当前真实dom元素
  if (ref) {
    ref.current = dom;
  }

  // 将虚拟dom的dom属性指向创建出来的dom属性
  vdom.dom = dom;
  return dom;
}

/**
 * 遍历所有子节点虚拟dom全部转成真实DOM并且插入到父节点中
 *
 * @param {Object} childrenVdomList 子节点的虚拟dom列表
 * @param {Object} parentDom 父节点dom元素对象
 */
function reconcileChildren(childrenVdomList, parentDom) {
  for (var i = 0; i < childrenVdomList.length; i++) {
    let vDom = childrenVdomList[i];
    render(vDom, parentDom);
  }
}

/**
 *
 * @param {*} oldVdom 旧的虚拟dom
 * @param {*} newVdom 新的虚拟dom
 * @param {*} parentDom 虚拟dom转化为真实dom之后要挂载的节点
 *
 * 比较差异 然后将差异更新了真实dom上
 * 1. 深度优先
 * 2. 同级比较
 */
export function compareTwoVdom(oldVdom, newVdom, parentDom,nextDom) {
  if (oldVdom == null && newVdom == null) {
    return null;
  } else if (oldVdom == null && newVdom) {
    // 生成新的真实domn并插入
    let newDom = createDom(newVdom);
    if(nextDom){
      parentDom.insertBefore(newDom,nextDom);
    }else{
      parentDom.appendChild(newDom);
    }
    

    // 重新给新的虚拟dom挂载一个dom属性指向新的真实dom
    newVdom.dom = newDom;
    return newVdom;
  } else if (oldVdom && newVdom == null) {
    // 先拿到旧的真实dom
    let oldDOM = oldVdom.dom;
    // 找到父节点然后删除
    parentDom.removeChild(oldDOM);
    // 旧组件卸载 触发生命周期函数
    if (oldVdom.classInstance.componentWillUnmount) {
      oldVdom.classInstance.componentWillUnmount();
    }
    // 返回新的虚拟dom是一个null
    return null;
  } else {
    // 双方都有 那么执行深度比较
    updateElement(oldVdom, newVdom);
    return newVdom;
  }
}

/**
 * DOM-DIFF 深度优先 递归比较
 * @param {*} oldVdom
 * @param {*} newVdom
 */
function updateElement(oldVdom, newVdom) {
  // 从oldVdom.dom上取到真实dom，然后依次赋值
  let currentTruthDom = (newVdom.dom = oldVdom.dom);
  // 让旧的虚拟dom的classInstance指向新的classInstance
  newVdom.classInstance = oldVdom.classInstance;
  // 判断新的是一个原生dom还是类组件
  if (typeof newVdom.type === "string") {
    updateProps(currentTruthDom, oldVdom.props, newVdom.props);
    updateChildren(
      currentTruthDom,
      oldVdom.props.children,
      newVdom.props.children
    );
  } else if (typeof oldVdom.type === "function") {
    updateClassInstance(oldVdom, newVdom);
  }
}

/**
 *
 * @param {*} dom 要添加的目标dom元素
 * @param {*} oldProps 旧的属性对象
 * @param {*} newProps 新的属性对象
 */
function updateProps(dom, oldProps, newProps) {
  for (let key in newProps) {
    if (key === "children") continue;
    if (key === "style") {
      let styleObj = newProps[key];
      for (let styleKey in styleObj) {
        dom.style[styleKey] = styleObj[styleKey];
      }
    } else if (key.startsWith("on")) {
      // 绑定合成事件
      addEvent(dom, key.toLocaleLowerCase(), newProps[key]);
      // dom[key.toLocaleLowerCase()] = newProps[key];
    } else if (key === "className") {
      dom[key] = newProps[key];
    }
  }
}

/**
 *
 * @param {*} parentDom 父真实dom
 * @param {*} oldChildren 老的虚拟dom儿子
 * @param {*} newChildren 新的虚拟dom儿子
 */
function updateChildren(parentDom, oldChildren, newChildren) {
  if (
    (typeof oldChildren === "string" || typeof newChildren === "number") &&
    (typeof oldChildren === "string" || typeof newChildren === "number")
  ) {
	if(oldChildren !== newChildren){
		parentDom.innerText = newChildren;
	}
	return;
  }

  // 如果传递进来的儿子都是字符串的话比如div元素中的字符串 那么需要做一层包装
  oldChildren = Array.isArray(oldChildren)?oldChildren:[oldChildren];
  newChildren = Array.isArray(newChildren)?newChildren:[newChildren];

  let maxLen = Math.max(oldChildren.length,newChildren.length);
  for (let i = 0; i < maxLen; i++) {
    // 递归 深度优先进行依次dom-diff
    // 找到当前虚拟dom对于的真实dom之后的存在的真实dom
    let nextDom = oldChildren.find((item,index)=>index>i && item && item.dom);
    compareTwoVdom(oldChildren[i],newChildren[i],parentDom,nextDom?.dom);
  }
}

/**
 * 类组件更新
 * @param {*} oldVdom 
 * @param {*} newVdom 
 */
function updateClassInstance(oldVdom,newVdom) {
	let classInstance = oldVdom.classInstance;

	// 当父组件更新的时候 子组件一定更新 会触发componentWillReceiveProps
	if(classInstance.componentWillReceiveProps){
		classInstance.componentWillReceiveProps();
	}
	// 把新的属性props传递给emitUpdate方法
	classInstance.updater.emitUpdate(newVdom.props);
}

const ReactDOM = {
  render,
};

export default ReactDOM;
