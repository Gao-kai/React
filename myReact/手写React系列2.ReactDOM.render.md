## ReactDOM.render实现
ReactDOM.render方法接收两个参数，第一个参数为RC函数返回的虚拟dom对象，也可以说是一个React元素，第二个参数是当前虚拟dom转化为真实dom结构只要要挂载到哪一个节点上。

```js
/**
 * @param {Object} vdom 虚拟DOM
 * @param {Object} container 虚拟dom生成真实dom元素后要插入的容器
 */
function render(vdom,container){
	const truthDom = createDom(vdom);
	container.appendChild(truthDom);
}
```

## createDom
核心就是实现createDom方法，传入虚拟dom对象生成真实的dom节点并返回,这里暂且不表，我们主要来研究下这里的vdom。

平时我们调用ReactDOM.render无非下面这几种场景：
1. 将一个纯文本、数字或null传入
```js
ReactDOM.render('lilei',container);
```
此时会直接返回一个文本节点即可

2. 将一段jsx代码传入
```js
let ele =  <div>
    <h1>hahaha</h1>
</div>
ReactDOM.render(ele,container);
```
此时在react内部会先将ele转化为RC函数返回的js虚拟dom，然后进行渲染

3. 将一个函数组件传入
```js
function Hello(props) {
    return (<div>
        <h1>{props.number}</h1>
      </div>)
}
let cpn = <Hello number="100"/>;
ReactDOM.render(cpn,container);
```
注意这里是重点：首先在react内部会拿到Hello组件的虚拟dom对象，发现这个虚拟dom对象的type不是字符串而是一个函数，那么会执行这个函数，拿到函数返回的jsx，这个jsx才是最终要渲染的renderVDOM，这个renderVDOM对象中的type才是真实的字符串也就是h1这种，这样才可以生成对应的节点并渲染。

然后将这个渲染的renderVdom传递给ReactDOM.render，生成最终的真实dom，然后渲染。

4. 将一个类组件传入
```js
class Counter extends React.Component {
  render() {
      return (
        <div>
            <h1>父组件Counter{this.state.number}</h1>
            <ChildCounter count={this.state.number + 10} />
            <button onClick={this.handleClick}>+</button>
        </div>
      );
    }
}
let cpn = <Counter number="100"/>;
ReactDOM.render(cpn,container);
```
首先会拿到类组件Counter的虚拟dom对象，发现这个虚拟dom对象的type是一个class类，那么会执行这个new这个类并将props当做参数传入生成一个实例，然后调用这个实例的render方法返回一个最终的renderVdom，和函数组件一样这个渲染renderVdom虚拟dom对象才是最终要被渲染到页面上的内容。

所以说，对于组件来说，一定是拿到randerVdom，然后是直接替换或者dom diff，最终生成新的真实dom进行渲染。

```js
/**
 * @param {Object} vdom 虚拟dom
 * 
 * 1.可能是一个字符串或者数字 那么直接返回文本节点即可
 * 2.可能是null或者undefined
 * 3.可能是单个React元素 也就是常见的createElement方法的返回值js对象
 */
export function createDom(vdom){
	
  // 直接返回文本节点
	if(typeof vdom === 'string' || typeof vdom === 'number'){
		return document.createTextNode(vdom);
	}
	
  // 如果是null或者undefined 那么而直接返回空
	if(!vdom){
		return "";
	}
	
  // 取出当前vdom中的tyoe属性 进行判断
	const {type,props,ref} = vdom;
	
	let dom;
	/* 
		如何区分一个组件是函数组件还是类组件
		1. 类组件本质还是 函数
    2. 类组件内部有一个静态属性isReactComponent表示这是一个类组件
	 */
	if(typeof type === 'function'){
		if(type.isReactComponent){
			// 类组件 type是一个类 那么走类组件的渲染流程
			return updateClassComponent(vdom);
		}else{
			// 函数式组件 type是一个函数 那么走函数组件的渲染流程
			return updateFunctionComponent(vdom);
		}
	}else{
    // 创建顶级元素节点
		dom = document.createElement(type); 

		/* 
      首先处理props中的除了children的所有属性
      处理的方法就是将虚拟dom中的值依次添加到真实dom上
    */
		updateProps(dom,{},props);

		/* 
      然后处理children的情况
      1. 如果是一个字符串或数字 直接插入到dom中
      2. 如果是一个React元素 那么就递归调用render，但是挂载的节点就是dom了不是continer
      3. 如果是多个 说明有一个子元素 此时遍历每一个 然后依次递归执行render
      4. 如果是其他情况 就直接将空串插入到dom中
    */
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
```

## updateProps方法
updateProps方法中后序会有dom diff的实现
除此之外，updateProps方法中会对事件进行合成事件的处理
```js

function updateProps(dom,oldProps,newProps){
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
```


## 类组件的渲染实现
为了方便起见：
1. 我们将vdom成为组件自己的虚拟dom，其type是一个类
2. 我们将renderVdom称为组件执行render之后返回的渲染虚拟dom，其type是一个元素节点名称
3. 我们将dom称为renderVdom生成的真实dom

下面是组件的渲染流程：
1. 取出type和props属性 此时type为类也就是一个class
2. new这个类并将props当做参数传入 得到一个classInstance也就是组件实例
3. 关联1：将组件自己的vdom上挂载一个属性classInstance，指向当前的组件实例
4. 执行生命周期函数componentWillMount
5. 执行render方法，拿到最终渲染的renderVdom
6. 将最终渲染的renderVdom传递给createDom方法生成真实dom节点，我们标记为dom
7. 关联2：vdom.dom = renderVdom.dom = dom;这一步的目的是无论在组件的虚拟dom还是渲染虚拟dom上都可以通过dom属性拿到最终渲染的真实dom
8. 关联3：classInstance.oldVdom = renderVdom; 在实例上挂载一个oldVdom属性指向这一次的renderVdom，便于以后的dom diff时从实例上获取到旧的renderVdom
9. 执行生命周期函数componentDidMount
10. 关联4：在classInstance上挂载dom属性指向真实dom
11. 返回真实dom
```js
/*
	类组件的虚拟dom渲染为真实dom
 */
function updateClassComponent(vdom){
	let {type,props} = vdom;
	// new 类组件得到类组件的实例 这一步会将props挂载到实例classInstance的props属性上
	let classInstance = new type(props);
	vdom.classInstance = classInstance;

	// 生命周期函数componentWillMount
	if(classInstance.componentWillMount && typeof classInstance.componentWillMount === 'function'){
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
	if(classInstance.componentDidMount && typeof classInstance.componentDidMount === 'function'){
		classInstance.componentDidMount();
	}

	classInstance.dom = dom;
	return dom;
}
```


## 函数组件的渲染实现

在上面的createDom中，当发现传入的虚拟dom的type是函数的时候就会走渲染函数组件的流程，主要如下：
1. 取出type和props属性，type是一个函数
2. 执行type函数并将props当做参数传入，会得到真正要渲染的html节点的虚拟dom对象renderVdom
3. 将这个renderVdom再次传递给createDom，生成真实dom，并挂载在一开始的container上面

```js
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
```
