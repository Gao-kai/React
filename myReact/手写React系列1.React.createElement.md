## babel 是如何将 jsx 转换为 RC 函数的的？

### 1. 单纯的 jsx 语法节点

```js
/* 
	JSX元素表示的元素节点 会在编译阶段通过babel转化为React.createElement表示
 */
let jsxEl = (
  <h1 className="title" style={{ color: "red" }}>
    <span>hello</span>
    world
  </h1>
);

/* 
将上述JSX语法通过babel转化为js语法的React.createElement表示
*/
let jsEl = React.createElement(
  "h1",
  {
    className: "title",
    style: {
      color: "red",
    },
  },
  React.createElement("span", null, "hello"),
  "world"
);
```

### 2. 函数式组件

```js
function WelCome(props){
	return <h1>你好呀,{props.name}</h1>
}

/* 
将上述JSX语法通过babel转化为js语法的React.createElement表示
*/
function WelCome(props) {
  return React.createElement("h1", null, "\u4F60\u597D\u5440,", props.name);
}
```

在组件调用时：
```js
<WelCome name="架构师"></WelCome>

// 会被转换为：
React.createElement(WelCome, {
  name: "\u67B6\u6784\u5E08"
});
```

### 3. 类组件嵌套子组件

```js
class Counter extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div>
        <h1>{this.state.number}</h1>
        {this.state.number === 4 ? null : (
          <ChildCounter count={this.state.number} />
        )}
        <button onClick={this.handleClick}>+</button>
      </div>
    );
  }
}
```

会被转化为：

```js
class Counter extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return React.createElement(
      "div",
      null,
      React.createElement("h1", null, this.state.number),
      this.state.number === 4
        ? null
        : React.createElement(ChildCounter, {
            count: this.state.number,
          }),
      React.createElement(
        "button",
        {
          onClick: this.handleClick,
        },
        "+"
      )
    );
  }
}
```
也就是说只要在react项目中遇到jsx写法，babel就会将其转化为RC函数调用的方式，等待后续在渲染的时候执行调用。
对于函数组件和类组件来说，它们在调用时的type不同，最终调用render方法的流程也不同，但本质上来说类组件会被编译为函数调用，最终是生成虚拟dom对象
然后交给ReactDom.render调用生成真实dom然后挂载。

## 手写实现 React.createElement 方法
现在我们的任务就是实现 React.createElement方法，将babel交给我们的代码通过 React.createElement 调用生成js对象也就是虚拟dom。
我们都知道 jsx 其实就是 React.createElement 方法的语法糖，下面是一个 jsx 结构转化为 js 语法的过程：

1. jsx 结构会被 babel-loader 识别给转化为 AST 抽象语法树
2. babel 会遍历这颗抽象语法树然后生成 React.createElement 方法表示的 js 函数调用
3. React.createElement 方法会返回一个 js 对象，这个 js 对象就是大名鼎鼎的虚拟 dom 对象
4. 将这个虚拟 dom 对象传递给 ReactDOM.render 方法就会实现挂载
5. 挂载完成 dom 渲染

需要注意的是 jsx 结构转化为 React.createElement()的函数字符串表示这个过程我们是实现不了的，这是 babel 实现的
我们需要实现的是转化为 React.createElement()表示之后，实现 React.createElement()将其进一步转化为 js 对象的过程
也就是从函数调用到生成虚拟 dom 对象的过程

1. type 可能是字符串，比如 h1、span 类似
2. 如果是函数式组件，那么这里的 type 是一个函数，函数内部会 return 一个 render 方法调用得到组件的虚拟 dom 对象
3. 如果是类组件，那么这里的 type 是一个类，可以 new 这个类得到一个组件实例然后调用实例上的 render 方法得到组件的虚拟 dom

```js
/**
 * @param {Object} type dom节点h1 类class 或者一个函数
 * @param {Object} config 元素属性对象 比如key包含className style 事件类型onclick ref等
 * @param {Object} children 元素第一个字节点，后面可能有多个子节点
 */
function createElement(type, config, children) {
  let ref;
  if (config) {
    delete config._owner;
    delete config._store;
    // 保存ref的值 然后删除 因为要将ref属性放到虚拟dom对象的和props同级的地方而不是和config同级
    ref = config.ref;
    delete config.ref;
  }
  // 复制
  let props = { ...config };

  /* 
		截取第二个参数之后的所有子节点，children可能是：
		1. null 也就是为空
		2.字符串或者数字
		3.单个子节点 也就是React元素
		4.多个子节点组成的数组，里面可能包含React元素 有可能包含单个字符串
	 */

  if (arguments.length > 3) {
    children = Array.prototype.slice.call(arguments, 2);
  }
  props.children = children;

  // 返回当前节点的虚拟DOM，也称为React元素
  return {
    type,
    props,
    ref,
  };
}
```


```js
// 打印返回的虚拟dom对象 它用js对象描述了这个jsEl的组成
console.log(JSON.stringify(jsEl,null,2));

{
    "type": "h1",
    "key": null,
    "ref": null,
    "props": {
        "className": "title",
        "style": {
            "color": "red"
        },
        "children": {
            "type": "span",
            "key": null,
            "ref": null,
            "props": {
                "children": "hello"
            },
        }
    },
}
```

## 分析得到的虚拟dom对象，它是一颗嵌套的结构树
每一层都有四个基本属性：
1. type 表示节点类型 可能是节点字符串 类或者函数
2. key 用于dom diff
3. ref 当前虚拟dom是否有真实dom引用，默认为null，如果有那么它的值是一个对象内部有current属性指向当前真实dom对象
4. props 每一个props中有许多属性，比如：
  + 类名 className
  + 样式对象 style
  + 事件绑定函数 onClick
  + 子节点 children

children如果只有一个子节点那么值是一个对象，如果有多个那么值是一个数组，每一个对象内部又是相同的结构，也就是包含type、props、key、ref
层层嵌套，最终构建出一颗虚拟dom树。