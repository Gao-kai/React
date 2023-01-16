class Updater {
	constructor(){
		this.state = {name:'lilei',age:18};
		this.quene = [];
	}
	
	setState(newState){
		this.quene.push(newState);
	}
	
	flushQuene(){
		for (var i = 0; i < this.quene.length; i++) {
			let update = this.quene[i];
			if(typeof update === 'function'){
				this.state = {...this.state,...update(this.state)};
			}else{
				this.state = {...this.state,...update};
			}
			console.log(this.state,'---')
		}
	}
}

const updater = new Updater();
updater.setState({age:18});
updater.setState((prevState)=>({age:prevState.age+1}));
updater.setState({age:19});
updater.flushQuene();

console.log(updater.state);