import Component from "./Component.js";

/**
 * @param {Object} type 元素节点 如h1 span等
 * @param {Object} config 元素属性对象 比如key包含className style 事件类型onclick ref等 
 * @param {Object} children 元素第一个字节点，后面可能有多个子节点
 */
function createElement(type,config,children){
	let ref;
	if(config){
		delete config._owner;
		delete config._store;
		// 保存ref的值 然后删除 因为要将ref属性放到虚拟dom对象的和props同级的地方而不是和config同级
		ref = config.ref;
		delete config.ref;
	}
	// 复制
	let props = {...config};
	
	/* 
		截取第二个参数之后的所有子节点，children可能是：
		1. null 也就是为空
		2.字符串或者数字
		3.单个子节点 也就是React元素
		4.多个子节点组成的数组，里面可能包含React元素 有可能包含单个字符串
	 */
	
	if(arguments.length > 3){
		children = Array.prototype.slice.call(arguments,2);
	}
	props.children = children;
	
	
	// 返回当前节点的虚拟DOM，也称为React元素
	return {
		type,
		props,
		ref
	}
}

/**
 * 创建一个引用对象
 */
function createRef(){
	return {
		current:null
	}
};

export const React = {
	createElement,
	Component,
	createRef,
};


export default React;