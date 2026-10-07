/* Row highlighting is independent of the batch-edit checkboxes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NSTStageSelection=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  class StageSelection {
    constructor(items=[]) {this.items=[];this.selected=new Set();this.focused=null;this.anchor=null;this.setItems(items);}
    setItems(items) {
      this.items=[...items];this.selected=new Set([...this.selected].filter(id=>items.includes(id)));
      if(!items.includes(this.focused))this.focused=items[0]??null;
      if(!items.includes(this.anchor))this.anchor=this.focused;
    }
    choose(id,{shift=false,ctrl=false}={}) {
      if(!this.items.includes(id))return;
      if(shift) {
        const a=this.items.indexOf(this.anchor??this.focused??id),b=this.items.indexOf(id);
        const range=this.items.slice(Math.min(a,b),Math.max(a,b)+1);
        this.selected=new Set(ctrl?[...this.selected,...range]:range);
      } else if(ctrl) {
        if(this.selected.has(id))this.selected.delete(id);else this.selected.add(id);
        this.anchor=id;
      } else {this.selected=new Set([id]);this.anchor=id;}
      this.focused=id;
    }
    move(delta,shift=false) {
      if(!this.items.length)return;
      const index=Math.max(0,this.items.indexOf(this.focused));
      this.choose(this.items[Math.max(0,Math.min(this.items.length-1,index+delta))],{shift});
    }
    targets(id) {return this.selected.size>1&&this.selected.has(id)?[...this.selected]:[id];}
  }
  return {StageSelection};
});
