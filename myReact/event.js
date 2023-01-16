import {updateQuene} from './Component.js'
/**
 * @param {Object} dom 原生dom元素
 * @param {Object} eventType 事件类型 比如click mouseenter
 * @param {Object} listener 事件处理函数
 * 
 */
export function addEvent(dom,eventType,listener){
	// 给dom元素添加一个属性store 用来存储eventType->listener的键值对映射
	let store = dom.store || (dom.store = {});
	store[eventType] = listener;
	
	// 事件委托 所有元素的事件最终都会冒泡到顶级元素对象上 不阻止冒泡
	document.addEventListener(eventType.slice(2),dispatchEvent,false);
}

/**
 * @param {Object} event 原生事件对象
 * 劫持事件处理函数
 * 然后重写它 在内部加入异步更新的标识符和手动触发异步批量延迟更新
 */
let syntheticEvent = {};
function dispatchEvent(event){
	/* 
		1. target 事件源dom对象 上面挂载了store属性 保存了当前dom元素的所有绑定事件的集合
		2. type 事件类型 type应该是click而不是onclick
	 */
	let {target,type} = event;
	let eventType = `on${type}`;
	
	// 当事件函数触发时  修改为异步更新策略
	updateQuene.isBatchingUpdate = true;
	// 执行事件处理函数 创建合成事件对象并传入
	syntheticEvent = createSyntheticEvent(event);
	
	// 处理事件冒泡
	while(target){
		// 取出当前事件的处理函数并执行
		let listener = target?.store?.[eventType];
		listener &&listener.call(target,syntheticEvent);
		// 指向父节点继续冒泡
		target = target.parentNode;
	}
	
	
	
	// 事件执行完成之后销毁合成事件对象
	for (let key in syntheticEvent) {
		syntheticEvent[key] = null;
	}
	
	// 取出所有updater依次执行组件更新updateComponent
	updateQuene.batchUpdate();
}

/* 
	1. 性能优化 用的时候创建 用完了就销毁
	2. 所有事件处理函数共用这一个对象
 */
function createSyntheticEvent(nativeEvent){
	for (let key in nativeEvent) {
		syntheticEvent[key] = nativeEvent[key];
	}
	return syntheticEvent;
}