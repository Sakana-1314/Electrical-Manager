import{f as j,aB as E,K as be,E as t,n as v,q as n,t as _,v as z,ax as ue,ac as he,ad as fe,ar as ve,av as ke,aJ as me,T as ge,y as H,g as xe,A as pe,X as Ce,a9 as N}from"./index-CnuJBKRN.js";import{u as G}from"./get-DsD_x2cB.js";import{j as V,k as s,r as P,c as I,p as ye,t as U,i as we}from"./vendor-vue-BcMl6tRj.js";import{c as Re}from"./light-CzL9ajGW.js";function Ie(e,a){if(!e)return;const i=document.createElement("a");i.href=e,a!==void 0&&(i.download=a),document.body.appendChild(i),i.click(),document.body.removeChild(i)}const L=be("n-checkbox-group"),ze={min:Number,max:Number,size:String,value:Array,defaultValue:{type:Array,default:null},disabled:{type:Boolean,default:void 0},"onUpdate:value":[Function,Array],onUpdateValue:[Function,Array],onChange:[Function,Array]},Fe=V({name:"CheckboxGroup",props:ze,setup(e){const{mergedClsPrefixRef:a}=j(e),i=E(e),{mergedSizeRef:S,mergedDisabledRef:T}=i,p=P(e.defaultValue),D=I(()=>e.value),u=G(D,p),$=I(()=>{var b;return((b=u.value)===null||b===void 0?void 0:b.length)||0}),c=I(()=>Array.isArray(u.value)?new Set(u.value):new Set);function C(b,r){const{nTriggerFormInput:y,nTriggerFormChange:k}=i,{onChange:l,"onUpdate:value":m,onUpdateValue:g}=e;if(Array.isArray(u.value)){const d=Array.from(u.value),M=d.findIndex(F=>F===r);b?~M||(d.push(r),g&&t(g,d,{actionType:"check",value:r}),m&&t(m,d,{actionType:"check",value:r}),y(),k(),p.value=d,l&&t(l,d)):~M&&(d.splice(M,1),g&&t(g,d,{actionType:"uncheck",value:r}),m&&t(m,d,{actionType:"uncheck",value:r}),l&&t(l,d),p.value=d,y(),k())}else b?(g&&t(g,[r],{actionType:"check",value:r}),m&&t(m,[r],{actionType:"check",value:r}),l&&t(l,[r]),p.value=[r],y(),k()):(g&&t(g,[],{actionType:"uncheck",value:r}),m&&t(m,[],{actionType:"uncheck",value:r}),l&&t(l,[]),p.value=[],y(),k())}return ye(L,{checkedCountRef:$,maxRef:U(e,"max"),minRef:U(e,"min"),valueSetRef:c,disabledRef:T,mergedSizeRef:S,toggleCheckbox:C}),{mergedClsPrefix:a}},render(){return s("div",{class:`${this.mergedClsPrefix}-checkbox-group`,role:"group"},this.$slots)}}),Se=()=>s("svg",{viewBox:"0 0 64 64",class:"check-icon"},s("path",{d:"M50.42,16.76L22.34,39.45l-8.1-11.46c-1.12-1.58-3.3-1.96-4.88-0.84c-1.58,1.12-1.95,3.3-0.84,4.88l10.26,14.51  c0.56,0.79,1.42,1.31,2.38,1.45c0.16,0.02,0.32,0.03,0.48,0.03c0.8,0,1.57-0.27,2.2-0.78l30.99-25.03c1.5-1.21,1.74-3.42,0.52-4.92  C54.13,15.78,51.93,15.55,50.42,16.76z"})),Te=()=>s("svg",{viewBox:"0 0 100 100",class:"line-icon"},s("path",{d:"M80.2,55.5H21.4c-2.8,0-5.1-2.5-5.1-5.5l0,0c0-3,2.3-5.5,5.1-5.5h58.7c2.8,0,5.1,2.5,5.1,5.5l0,0C85.2,53.1,82.9,55.5,80.2,55.5z"})),De=v([n("checkbox",`
 font-size: var(--n-font-size);
 outline: none;
 cursor: pointer;
 display: inline-flex;
 flex-wrap: nowrap;
 align-items: flex-start;
 word-break: break-word;
 line-height: var(--n-size);
 --n-merged-color-table: var(--n-color-table);
 `,[_("show-label","line-height: var(--n-label-line-height);"),v("&:hover",[n("checkbox-box",[z("border","border: var(--n-border-checked);")])]),v("&:focus:not(:active)",[n("checkbox-box",[z("border",`
 border: var(--n-border-focus);
 box-shadow: var(--n-box-shadow-focus);
 `)])]),_("inside-table",[n("checkbox-box",`
 background-color: var(--n-merged-color-table);
 `)]),_("checked",[n("checkbox-box",`
 background-color: var(--n-color-checked);
 `,[n("checkbox-icon",[v(".check-icon",`
 opacity: 1;
 transform: scale(1);
 `)])])]),_("indeterminate",[n("checkbox-box",[n("checkbox-icon",[v(".check-icon",`
 opacity: 0;
 transform: scale(.5);
 `),v(".line-icon",`
 opacity: 1;
 transform: scale(1);
 `)])])]),_("checked, indeterminate",[v("&:focus:not(:active)",[n("checkbox-box",[z("border",`
 border: var(--n-border-checked);
 box-shadow: var(--n-box-shadow-focus);
 `)])]),n("checkbox-box",`
 background-color: var(--n-color-checked);
 border-left: 0;
 border-top: 0;
 `,[z("border",{border:"var(--n-border-checked)"})])]),_("disabled",{cursor:"not-allowed"},[_("checked",[n("checkbox-box",`
 background-color: var(--n-color-disabled-checked);
 `,[z("border",{border:"var(--n-border-disabled-checked)"}),n("checkbox-icon",[v(".check-icon, .line-icon",{fill:"var(--n-check-mark-color-disabled-checked)"})])])]),n("checkbox-box",`
 background-color: var(--n-color-disabled);
 `,[z("border",`
 border: var(--n-border-disabled);
 `),n("checkbox-icon",[v(".check-icon, .line-icon",`
 fill: var(--n-check-mark-color-disabled);
 `)])]),z("label",`
 color: var(--n-text-color-disabled);
 `)]),n("checkbox-box-wrapper",`
 position: relative;
 width: var(--n-size);
 flex-shrink: 0;
 flex-grow: 0;
 user-select: none;
 -webkit-user-select: none;
 `),n("checkbox-box",`
 position: absolute;
 left: 0;
 top: 50%;
 transform: translateY(-50%);
 height: var(--n-size);
 width: var(--n-size);
 display: inline-block;
 box-sizing: border-box;
 border-radius: var(--n-border-radius);
 background-color: var(--n-color);
 transition: background-color 0.3s var(--n-bezier);
 `,[z("border",`
 transition:
 border-color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier);
 border-radius: inherit;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 border: var(--n-border);
 `),n("checkbox-icon",`
 display: flex;
 align-items: center;
 justify-content: center;
 position: absolute;
 left: 1px;
 right: 1px;
 top: 1px;
 bottom: 1px;
 `,[v(".check-icon, .line-icon",`
 width: 100%;
 fill: var(--n-check-mark-color);
 opacity: 0;
 transform: scale(0.5);
 transform-origin: center;
 transition:
 fill 0.3s var(--n-bezier),
 transform 0.3s var(--n-bezier),
 opacity 0.3s var(--n-bezier),
 border-color 0.3s var(--n-bezier);
 `),ue({left:"1px",top:"1px"})])]),z("label",`
 color: var(--n-text-color);
 transition: color .3s var(--n-bezier);
 user-select: none;
 -webkit-user-select: none;
 padding: var(--n-label-padding);
 font-weight: var(--n-label-font-weight);
 `,[v("&:empty",{display:"none"})])]),he(n("checkbox",`
 --n-merged-color-table: var(--n-color-table-modal);
 `)),fe(n("checkbox",`
 --n-merged-color-table: var(--n-color-table-popover);
 `))]),_e=Object.assign(Object.assign({},H.props),{size:String,checked:{type:[Boolean,String,Number],default:void 0},defaultChecked:{type:[Boolean,String,Number],default:!1},value:[String,Number],disabled:{type:Boolean,default:void 0},indeterminate:Boolean,label:String,focusable:{type:Boolean,default:!0},checkedValue:{type:[Boolean,String,Number],default:!0},uncheckedValue:{type:[Boolean,String,Number],default:!1},"onUpdate:checked":[Function,Array],onUpdateChecked:[Function,Array],privateInsideTable:Boolean,onChange:[Function,Array]}),Pe=V({name:"Checkbox",props:_e,setup(e){const a=we(L,null),i=P(null),{mergedClsPrefixRef:S,inlineThemeDisabled:T,mergedRtlRef:p,mergedComponentPropsRef:D}=j(e),u=P(e.defaultChecked),$=U(e,"checked"),c=G($,u),C=ge(()=>{if(a){const o=a.valueSetRef.value;return o&&e.value!==void 0?o.has(e.value):!1}else return c.value===e.checkedValue}),b=E(e,{mergedSize(o){var h,f;const{size:x}=e;if(x!==void 0)return x;if(a){const{value:R}=a.mergedSizeRef;if(R!==void 0)return R}if(o){const{mergedSize:R}=o;if(R!==void 0)return R.value}const w=(f=(h=D?.value)===null||h===void 0?void 0:h.Checkbox)===null||f===void 0?void 0:f.size;return w||"medium"},mergedDisabled(o){const{disabled:h}=e;if(h!==void 0)return h;if(a){if(a.disabledRef.value)return!0;const{maxRef:{value:f},checkedCountRef:x}=a;if(f!==void 0&&x.value>=f&&!C.value)return!0;const{minRef:{value:w}}=a;if(w!==void 0&&x.value<=w&&C.value)return!0}return o?o.disabled.value:!1}}),{mergedDisabledRef:r,mergedSizeRef:y}=b,k=H("Checkbox","-checkbox",De,Re,e,S);function l(o){if(a&&e.value!==void 0)a.toggleCheckbox(!C.value,e.value);else{const{onChange:h,"onUpdate:checked":f,onUpdateChecked:x}=e,{nTriggerFormInput:w,nTriggerFormChange:R}=b,B=C.value?e.uncheckedValue:e.checkedValue;f&&t(f,B,o),x&&t(x,B,o),h&&t(h,B,o),w(),R(),u.value=B}}function m(o){r.value||l(o)}function g(o){if(!r.value)switch(o.key){case" ":case"Enter":l(o)}}function d(o){o.key===" "&&o.preventDefault()}const M={focus:()=>{var o;(o=i.value)===null||o===void 0||o.focus()},blur:()=>{var o;(o=i.value)===null||o===void 0||o.blur()}},F=xe("Checkbox",p,S),K=I(()=>{const{value:o}=y,{common:{cubicBezierEaseInOut:h},self:{borderRadius:f,color:x,colorChecked:w,colorDisabled:R,colorTableHeader:B,colorTableHeaderModal:O,colorTableHeaderPopover:W,checkMarkColor:q,checkMarkColorDisabled:J,border:X,borderFocus:Y,borderDisabled:Q,borderChecked:Z,boxShadowFocus:ee,textColor:oe,textColorDisabled:re,checkMarkColorDisabledChecked:ne,colorDisabledChecked:ae,borderDisabledChecked:ce,labelPadding:le,labelLineHeight:ie,labelFontWeight:te,[N("fontSize",o)]:de,[N("size",o)]:se}}=k.value;return{"--n-label-line-height":ie,"--n-label-font-weight":te,"--n-size":se,"--n-bezier":h,"--n-border-radius":f,"--n-border":X,"--n-border-checked":Z,"--n-border-focus":Y,"--n-border-disabled":Q,"--n-border-disabled-checked":ce,"--n-box-shadow-focus":ee,"--n-color":x,"--n-color-checked":w,"--n-color-table":B,"--n-color-table-modal":O,"--n-color-table-popover":W,"--n-color-disabled":R,"--n-color-disabled-checked":ae,"--n-text-color":oe,"--n-text-color-disabled":re,"--n-check-mark-color":q,"--n-check-mark-color-disabled":J,"--n-check-mark-color-disabled-checked":ne,"--n-font-size":de,"--n-label-padding":le}}),A=T?pe("checkbox",I(()=>y.value[0]),K,e):void 0;return Object.assign(b,M,{rtlEnabled:F,selfRef:i,mergedClsPrefix:S,mergedDisabled:r,renderedChecked:C,mergedTheme:k,labelId:Ce(),handleClick:m,handleKeyUp:g,handleKeyDown:d,cssVars:T?void 0:K,themeClass:A?.themeClass,onRender:A?.onRender})},render(){var e;const{$slots:a,renderedChecked:i,mergedDisabled:S,indeterminate:T,privateInsideTable:p,cssVars:D,labelId:u,label:$,mergedClsPrefix:c,focusable:C,handleKeyUp:b,handleKeyDown:r,handleClick:y}=this;(e=this.onRender)===null||e===void 0||e.call(this);const k=ve(a.default,l=>$||l?s("span",{class:`${c}-checkbox__label`,id:u},$||l):null);return s("div",{ref:"selfRef",class:[`${c}-checkbox`,this.themeClass,this.rtlEnabled&&`${c}-checkbox--rtl`,i&&`${c}-checkbox--checked`,S&&`${c}-checkbox--disabled`,T&&`${c}-checkbox--indeterminate`,p&&`${c}-checkbox--inside-table`,k&&`${c}-checkbox--show-label`],tabindex:S||!C?void 0:0,role:"checkbox","aria-checked":T?"mixed":i,"aria-labelledby":u,style:D,onKeyup:b,onKeydown:r,onClick:y,onMousedown:()=>{me("selectstart",window,l=>{l.preventDefault()},{once:!0})}},s("div",{class:`${c}-checkbox-box-wrapper`}," ",s("div",{class:`${c}-checkbox-box`},s(ke,null,{default:()=>this.indeterminate?s("div",{key:"indeterminate",class:`${c}-checkbox-icon`},Te()):s("div",{key:"check",class:`${c}-checkbox-icon`},Se())}),s("div",{class:`${c}-checkbox-box__border`}))),k)}});export{Fe as N,Pe as _,Ie as d};
