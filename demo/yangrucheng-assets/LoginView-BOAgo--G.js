import{j as ae,k as f,r as T,i as Ie,v as Ct,F as Oe,c as te,w as de,d as Rt,n as Tt,B as zt,u as $t,A as Pt,x as ve,D as kt,p as Lt,t as M,b as Wt,R as Y,$ as E,L as Et,h as J,W as A,U as F,P as Bt,a0 as At,Q as Z,a1 as jt,a2 as It,a3 as Ot,G as qt}from"./vendor-vue-vqiuIG17.js";import{u as Ht,i as Ft,a as ce,r as Nt,c as Mt,t as Dt,N as Vt,b as Ut,d as Xt,o as Gt,e as n,f as l,g as S,h as W,j as Kt,k as ge,l as Pe,V as he,m as Qt,n as qe,p as Yt,q as Jt,s as D,v as ie,w as le,x as Zt,y as me,_ as ea,z as ta,B as aa}from"./index-DdpJiXO9.js";import{L as ra}from"./branding-COIohYZq.js";import{u as na}from"./use-message-IKkB6i5L.js";import{A as oa}from"./Add-Dx_mOkUF.js";import{c as sa,a as ke,o as ia,_ as la}from"./Input-C2qnmBuk.js";import{t as da}from"./light-CGujqkPh.js";import{u as ca,a as Le}from"./get-CbyS0LBV.js";import{_ as ba,a as fa}from"./FormItem-Boqhnt54.js";import{N as ua}from"./Spin-Z3glNe4v.js";import{_ as pa}from"./_plugin-vue_export-helper-DlAUqK2U.js";import"./use-locale-CN4CCzs8.js";import"./light-B9GKxIQb.js";import"./light-DrlIxgm7.js";import"./format-length-B-p6aW7q.js";import"./light-CBhpTxq1.js";const va=ke(".v-x-scroll",{overflow:"auto",scrollbarWidth:"none"},[ke("&::-webkit-scrollbar",{width:0,height:0})]),ga=ae({name:"XScroll",props:{disabled:Boolean,onScroll:Function},setup(){const e=T(null);function o(c){!(c.currentTarget.offsetWidth<c.currentTarget.scrollWidth)||c.deltaY===0||(c.currentTarget.scrollLeft+=c.deltaY+c.deltaX,c.preventDefault())}const d=Ht();return va.mount({id:"vueuc/x-scroll",head:!0,anchorMetaName:sa,ssr:d}),Object.assign({selfRef:e,handleWheel:o},{scrollTo(...c){var x;(x=e.value)===null||x===void 0||x.scrollTo(...c)}})},render(){return f("div",{ref:"selfRef",onScroll:this.onScroll,onWheel:this.disabled?void 0:this.handleWheel,class:"v-x-scroll"},this.$slots)}});var ha=/\s/;function ma(e){for(var o=e.length;o--&&ha.test(e.charAt(o)););return o}var xa=/^\s+/;function ya(e){return e&&e.slice(0,ma(e)+1).replace(xa,"")}var We=NaN,wa=/^[-+]0x[0-9a-f]+$/i,_a=/^0b[01]+$/i,Sa=/^0o[0-7]+$/i,Ca=parseInt;function Ee(e){if(typeof e=="number")return e;if(Ft(e))return We;if(ce(e)){var o=typeof e.valueOf=="function"?e.valueOf():e;e=ce(o)?o+"":o}if(typeof e!="string")return e===0?e:+e;e=ya(e);var d=_a.test(e);return d||Sa.test(e)?Ca(e.slice(2),d?2:8):wa.test(e)?We:+e}var xe=function(){return Nt.Date.now()},Ra="Expected a function",Ta=Math.max,za=Math.min;function $a(e,o,d){var v,c,x,g,u,m,h=0,p=!1,C=!1,P=!0;if(typeof e!="function")throw new TypeError(Ra);o=Ee(o)||0,ce(d)&&(p=!!d.leading,C="maxWait"in d,x=C?Ta(Ee(d.maxWait)||0,o):x,P="trailing"in d?!!d.trailing:P);function _(r){var L=v,N=c;return v=c=void 0,h=r,g=e.apply(N,L),g}function y(r){return h=r,u=setTimeout($,o),p?_(r):g}function w(r){var L=r-m,N=r-h,I=o-L;return C?za(I,x-N):I}function k(r){var L=r-m,N=r-h;return m===void 0||L>=o||L<0||C&&N>=x}function $(){var r=xe();if(k(r))return R(r);u=setTimeout($,w(r))}function R(r){return u=void 0,P&&v?_(r):(v=c=void 0,g)}function B(){u!==void 0&&clearTimeout(u),h=0,v=m=c=u=void 0}function j(){return u===void 0?g:R(xe())}function i(){var r=xe(),L=k(r);if(v=arguments,c=this,m=r,L){if(u===void 0)return y(m);if(C)return clearTimeout(u),u=setTimeout($,o),_(m)}return u===void 0&&(u=setTimeout($,o)),g}return i.cancel=B,i.flush=j,i}var Pa="Expected a function";function ka(e,o,d){var v=!0,c=!0;if(typeof e!="function")throw new TypeError(Pa);return ce(d)&&(v="leading"in d?!!d.leading:v,c="trailing"in d?!!d.trailing:c),$a(e,o,{leading:v,maxWait:o,trailing:c})}const Se=Mt("n-tabs"),He={tab:[String,Number,Object,Function],name:{type:[String,Number],required:!0},disabled:Boolean,displayDirective:{type:String,default:"if"},closable:{type:Boolean,default:void 0},tabProps:Object,label:[String,Number,Object,Function]},La=ae({__TAB_PANE__:!0,name:"TabPane",alias:["TabPanel"],props:He,slots:Object,setup(e){const o=Ie(Se,null);return o||Dt("tab-pane","`n-tab-pane` must be placed inside `n-tabs`."),{style:o.paneStyleRef,class:o.paneClassRef,mergedClsPrefix:o.mergedClsPrefixRef}},render(){return f("div",{class:[`${this.mergedClsPrefix}-tab-pane`,this.class],style:this.style},this.$slots)}}),Wa=Object.assign({internalLeftPadded:Boolean,internalAddable:Boolean,internalCreatedByPane:Boolean},Gt(He,["displayDirective"])),_e=ae({__TAB__:!0,inheritAttrs:!1,name:"Tab",props:Wa,setup(e){const{mergedClsPrefixRef:o,valueRef:d,typeRef:v,closableRef:c,tabStyleRef:x,addTabStyleRef:g,tabClassRef:u,addTabClassRef:m,tabChangeIdRef:h,onBeforeLeaveRef:p,triggerRef:C,handleAdd:P,activateTab:_,handleClose:y}=Ie(Se);return{trigger:C,mergedClosable:te(()=>{if(e.internalAddable)return!1;const{closable:w}=e;return w===void 0?c.value:w}),style:x,addStyle:g,tabClass:u,addTabClass:m,clsPrefix:o,value:d,type:v,handleClose(w){w.stopPropagation(),!e.disabled&&y(e.name)},activateTab(){if(e.disabled)return;if(e.internalAddable){P();return}const{name:w}=e,k=++h.id;if(w!==d.value){const{value:$}=p;$?Promise.resolve($(e.name,d.value)).then(R=>{R&&h.id===k&&_(w)}):_(w)}}}},render(){const{internalAddable:e,clsPrefix:o,name:d,disabled:v,label:c,tab:x,value:g,mergedClosable:u,trigger:m,$slots:{default:h}}=this,p=c??x;return f("div",{class:`${o}-tabs-tab-wrapper`},this.internalLeftPadded?f("div",{class:`${o}-tabs-tab-pad`}):null,f("div",Object.assign({key:d,"data-name":d,"data-disabled":v?!0:void 0},Ct({class:[`${o}-tabs-tab`,g===d&&`${o}-tabs-tab--active`,v&&`${o}-tabs-tab--disabled`,u&&`${o}-tabs-tab--closable`,e&&`${o}-tabs-tab--addable`,e?this.addTabClass:this.tabClass],onClick:m==="click"?this.activateTab:void 0,onMouseenter:m==="hover"?this.activateTab:void 0,style:e?this.addStyle:this.style},this.internalCreatedByPane?this.tabProps||{}:this.$attrs)),f("span",{class:`${o}-tabs-tab__label`},e?f(Oe,null,f("div",{class:`${o}-tabs-tab__height-placeholder`}," "),f(Vt,{clsPrefix:o},{default:()=>f(oa,null)})):h?h():typeof p=="object"?p:Ut(p??d)),u&&this.type==="card"?f(Xt,{clsPrefix:o,class:`${o}-tabs-tab__close`,onClick:this.handleClose,disabled:v}):null))}}),Ea=n("tabs",`
 box-sizing: border-box;
 width: 100%;
 display: flex;
 flex-direction: column;
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
`,[l("segment-type",[n("tabs-rail",[S("&.transition-disabled",[n("tabs-capsule",`
 transition: none;
 `)])])]),l("top",[n("tab-pane",`
 padding: var(--n-pane-padding-top) var(--n-pane-padding-right) var(--n-pane-padding-bottom) var(--n-pane-padding-left);
 `)]),l("left",[n("tab-pane",`
 padding: var(--n-pane-padding-right) var(--n-pane-padding-bottom) var(--n-pane-padding-left) var(--n-pane-padding-top);
 `)]),l("left, right",`
 flex-direction: row;
 `,[n("tabs-bar",`
 width: 2px;
 right: 0;
 transition:
 top .2s var(--n-bezier),
 max-height .2s var(--n-bezier),
 background-color .3s var(--n-bezier);
 `),n("tabs-tab",`
 padding: var(--n-tab-padding-vertical); 
 `)]),l("right",`
 flex-direction: row-reverse;
 `,[n("tab-pane",`
 padding: var(--n-pane-padding-left) var(--n-pane-padding-top) var(--n-pane-padding-right) var(--n-pane-padding-bottom);
 `),n("tabs-bar",`
 left: 0;
 `)]),l("bottom",`
 flex-direction: column-reverse;
 justify-content: flex-end;
 `,[n("tab-pane",`
 padding: var(--n-pane-padding-bottom) var(--n-pane-padding-right) var(--n-pane-padding-top) var(--n-pane-padding-left);
 `),n("tabs-bar",`
 top: 0;
 `)]),n("tabs-rail",`
 position: relative;
 padding: 3px;
 border-radius: var(--n-tab-border-radius);
 width: 100%;
 background-color: var(--n-color-segment);
 transition: background-color .3s var(--n-bezier);
 display: flex;
 align-items: center;
 `,[n("tabs-capsule",`
 border-radius: var(--n-tab-border-radius);
 position: absolute;
 pointer-events: none;
 background-color: var(--n-tab-color-segment);
 box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .08);
 transition: transform 0.3s var(--n-bezier);
 `),n("tabs-tab-wrapper",`
 flex-basis: 0;
 flex-grow: 1;
 display: flex;
 align-items: center;
 justify-content: center;
 `,[n("tabs-tab",`
 overflow: hidden;
 border-radius: var(--n-tab-border-radius);
 width: 100%;
 display: flex;
 align-items: center;
 justify-content: center;
 `,[l("active",`
 font-weight: var(--n-font-weight-strong);
 color: var(--n-tab-text-color-active);
 `),S("&:hover",`
 color: var(--n-tab-text-color-hover);
 `)])])]),l("flex",[n("tabs-nav",`
 width: 100%;
 position: relative;
 `,[n("tabs-wrapper",`
 width: 100%;
 `,[n("tabs-tab",`
 margin-right: 0;
 `)])])]),n("tabs-nav",`
 box-sizing: border-box;
 line-height: 1.5;
 display: flex;
 transition: border-color .3s var(--n-bezier);
 `,[W("prefix, suffix",`
 display: flex;
 align-items: center;
 `),W("prefix","padding-right: 16px;"),W("suffix","padding-left: 16px;")]),l("top, bottom",[S(">",[n("tabs-nav",[n("tabs-nav-scroll-wrapper",[S("&::before",`
 top: 0;
 bottom: 0;
 left: 0;
 width: 20px;
 `),S("&::after",`
 top: 0;
 bottom: 0;
 right: 0;
 width: 20px;
 `),l("shadow-start",[S("&::before",`
 box-shadow: inset 10px 0 8px -8px rgba(0, 0, 0, .12);
 `)]),l("shadow-end",[S("&::after",`
 box-shadow: inset -10px 0 8px -8px rgba(0, 0, 0, .12);
 `)])])])])]),l("left, right",[n("tabs-nav-scroll-content",`
 flex-direction: column;
 `),S(">",[n("tabs-nav",[n("tabs-nav-scroll-wrapper",[S("&::before",`
 top: 0;
 left: 0;
 right: 0;
 height: 20px;
 `),S("&::after",`
 bottom: 0;
 left: 0;
 right: 0;
 height: 20px;
 `),l("shadow-start",[S("&::before",`
 box-shadow: inset 0 10px 8px -8px rgba(0, 0, 0, .12);
 `)]),l("shadow-end",[S("&::after",`
 box-shadow: inset 0 -10px 8px -8px rgba(0, 0, 0, .12);
 `)])])])])]),n("tabs-nav-scroll-wrapper",`
 flex: 1;
 position: relative;
 overflow: hidden;
 `,[n("tabs-nav-y-scroll",`
 height: 100%;
 width: 100%;
 overflow-y: auto; 
 scrollbar-width: none;
 `,[S("&::-webkit-scrollbar, &::-webkit-scrollbar-track-piece, &::-webkit-scrollbar-thumb",`
 width: 0;
 height: 0;
 display: none;
 `)]),S("&::before, &::after",`
 transition: box-shadow .3s var(--n-bezier);
 pointer-events: none;
 content: "";
 position: absolute;
 z-index: 1;
 `)]),n("tabs-nav-scroll-content",`
 display: flex;
 position: relative;
 min-width: 100%;
 min-height: 100%;
 width: fit-content;
 box-sizing: border-box;
 `),n("tabs-wrapper",`
 display: inline-flex;
 flex-wrap: nowrap;
 position: relative;
 `),n("tabs-tab-wrapper",`
 display: flex;
 flex-wrap: nowrap;
 flex-shrink: 0;
 flex-grow: 0;
 `),n("tabs-tab",`
 cursor: pointer;
 white-space: nowrap;
 flex-wrap: nowrap;
 display: inline-flex;
 align-items: center;
 color: var(--n-tab-text-color);
 font-size: var(--n-tab-font-size);
 background-clip: padding-box;
 padding: var(--n-tab-padding);
 transition:
 box-shadow .3s var(--n-bezier),
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[l("disabled",{cursor:"not-allowed"}),W("close",`
 margin-left: 6px;
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `),W("label",`
 display: flex;
 align-items: center;
 z-index: 1;
 `)]),n("tabs-bar",`
 position: absolute;
 bottom: 0;
 height: 2px;
 border-radius: 1px;
 background-color: var(--n-bar-color);
 transition:
 left .2s var(--n-bezier),
 max-width .2s var(--n-bezier),
 opacity .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 `,[S("&.transition-disabled",`
 transition: none;
 `),l("disabled",`
 background-color: var(--n-tab-text-color-disabled)
 `)]),n("tabs-pane-wrapper",`
 position: relative;
 overflow: hidden;
 transition: max-height .2s var(--n-bezier);
 `),n("tab-pane",`
 color: var(--n-pane-text-color);
 width: 100%;
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 opacity .2s var(--n-bezier);
 left: 0;
 right: 0;
 top: 0;
 `,[S("&.next-transition-leave-active, &.prev-transition-leave-active, &.next-transition-enter-active, &.prev-transition-enter-active",`
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 transform .2s var(--n-bezier),
 opacity .2s var(--n-bezier);
 `),S("&.next-transition-leave-active, &.prev-transition-leave-active",`
 position: absolute;
 `),S("&.next-transition-enter-from, &.prev-transition-leave-to",`
 transform: translateX(32px);
 opacity: 0;
 `),S("&.next-transition-leave-to, &.prev-transition-enter-from",`
 transform: translateX(-32px);
 opacity: 0;
 `),S("&.next-transition-leave-from, &.next-transition-enter-to, &.prev-transition-leave-from, &.prev-transition-enter-to",`
 transform: translateX(0);
 opacity: 1;
 `)]),n("tabs-tab-pad",`
 box-sizing: border-box;
 width: var(--n-tab-gap);
 flex-grow: 0;
 flex-shrink: 0;
 `),l("line-type, bar-type",[n("tabs-tab",`
 font-weight: var(--n-tab-font-weight);
 box-sizing: border-box;
 vertical-align: bottom;
 `,[S("&:hover",{color:"var(--n-tab-text-color-hover)"}),l("active",`
 color: var(--n-tab-text-color-active);
 font-weight: var(--n-tab-font-weight-active);
 `),l("disabled",{color:"var(--n-tab-text-color-disabled)"})])]),n("tabs-nav",[l("line-type",[l("top",[W("prefix, suffix",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),n("tabs-nav-scroll-content",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),n("tabs-bar",`
 bottom: -1px;
 `)]),l("left",[W("prefix, suffix",`
 border-right: 1px solid var(--n-tab-border-color);
 `),n("tabs-nav-scroll-content",`
 border-right: 1px solid var(--n-tab-border-color);
 `),n("tabs-bar",`
 right: -1px;
 `)]),l("right",[W("prefix, suffix",`
 border-left: 1px solid var(--n-tab-border-color);
 `),n("tabs-nav-scroll-content",`
 border-left: 1px solid var(--n-tab-border-color);
 `),n("tabs-bar",`
 left: -1px;
 `)]),l("bottom",[W("prefix, suffix",`
 border-top: 1px solid var(--n-tab-border-color);
 `),n("tabs-nav-scroll-content",`
 border-top: 1px solid var(--n-tab-border-color);
 `),n("tabs-bar",`
 top: -1px;
 `)]),W("prefix, suffix",`
 transition: border-color .3s var(--n-bezier);
 `),n("tabs-nav-scroll-content",`
 transition: border-color .3s var(--n-bezier);
 `),n("tabs-bar",`
 border-radius: 0;
 `)]),l("card-type",[W("prefix, suffix",`
 transition: border-color .3s var(--n-bezier);
 `),n("tabs-pad",`
 flex-grow: 1;
 transition: border-color .3s var(--n-bezier);
 `),n("tabs-tab-pad",`
 transition: border-color .3s var(--n-bezier);
 `),n("tabs-tab",`
 font-weight: var(--n-tab-font-weight);
 border: 1px solid var(--n-tab-border-color);
 background-color: var(--n-tab-color);
 box-sizing: border-box;
 position: relative;
 vertical-align: bottom;
 display: flex;
 justify-content: space-between;
 font-size: var(--n-tab-font-size);
 color: var(--n-tab-text-color);
 `,[l("addable",`
 padding-left: 8px;
 padding-right: 8px;
 font-size: 16px;
 justify-content: center;
 `,[W("height-placeholder",`
 width: 0;
 font-size: var(--n-tab-font-size);
 `),Kt("disabled",[S("&:hover",`
 color: var(--n-tab-text-color-hover);
 `)])]),l("closable","padding-right: 8px;"),l("active",`
 background-color: #0000;
 font-weight: var(--n-tab-font-weight-active);
 color: var(--n-tab-text-color-active);
 `),l("disabled","color: var(--n-tab-text-color-disabled);")])]),l("left, right",`
 flex-direction: column; 
 `,[W("prefix, suffix",`
 padding: var(--n-tab-padding-vertical);
 `),n("tabs-wrapper",`
 flex-direction: column;
 `),n("tabs-tab-wrapper",`
 flex-direction: column;
 `,[n("tabs-tab-pad",`
 height: var(--n-tab-gap-vertical);
 width: 100%;
 `)])]),l("top",[l("card-type",[n("tabs-scroll-padding","border-bottom: 1px solid var(--n-tab-border-color);"),W("prefix, suffix",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),n("tabs-tab",`
 border-top-left-radius: var(--n-tab-border-radius);
 border-top-right-radius: var(--n-tab-border-radius);
 `,[l("active",`
 border-bottom: 1px solid #0000;
 `)]),n("tabs-tab-pad",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),n("tabs-pad",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `)])]),l("left",[l("card-type",[n("tabs-scroll-padding","border-right: 1px solid var(--n-tab-border-color);"),W("prefix, suffix",`
 border-right: 1px solid var(--n-tab-border-color);
 `),n("tabs-tab",`
 border-top-left-radius: var(--n-tab-border-radius);
 border-bottom-left-radius: var(--n-tab-border-radius);
 `,[l("active",`
 border-right: 1px solid #0000;
 `)]),n("tabs-tab-pad",`
 border-right: 1px solid var(--n-tab-border-color);
 `),n("tabs-pad",`
 border-right: 1px solid var(--n-tab-border-color);
 `)])]),l("right",[l("card-type",[n("tabs-scroll-padding","border-left: 1px solid var(--n-tab-border-color);"),W("prefix, suffix",`
 border-left: 1px solid var(--n-tab-border-color);
 `),n("tabs-tab",`
 border-top-right-radius: var(--n-tab-border-radius);
 border-bottom-right-radius: var(--n-tab-border-radius);
 `,[l("active",`
 border-left: 1px solid #0000;
 `)]),n("tabs-tab-pad",`
 border-left: 1px solid var(--n-tab-border-color);
 `),n("tabs-pad",`
 border-left: 1px solid var(--n-tab-border-color);
 `)])]),l("bottom",[l("card-type",[n("tabs-scroll-padding","border-top: 1px solid var(--n-tab-border-color);"),W("prefix, suffix",`
 border-top: 1px solid var(--n-tab-border-color);
 `),n("tabs-tab",`
 border-bottom-left-radius: var(--n-tab-border-radius);
 border-bottom-right-radius: var(--n-tab-border-radius);
 `,[l("active",`
 border-top: 1px solid #0000;
 `)]),n("tabs-tab-pad",`
 border-top: 1px solid var(--n-tab-border-color);
 `),n("tabs-pad",`
 border-top: 1px solid var(--n-tab-border-color);
 `)])])])]),ye=ka,Ba=Object.assign(Object.assign({},qe.props),{value:[String,Number],defaultValue:[String,Number],trigger:{type:String,default:"click"},type:{type:String,default:"bar"},closable:Boolean,justifyContent:String,size:String,placement:{type:String,default:"top"},tabStyle:[String,Object],tabClass:String,addTabStyle:[String,Object],addTabClass:String,barWidth:Number,paneClass:String,paneStyle:[String,Object],paneWrapperClass:String,paneWrapperStyle:[String,Object],addable:[Boolean,Object],tabsPadding:{type:Number,default:0},animated:Boolean,onBeforeLeave:Function,onAdd:Function,"onUpdate:value":[Function,Array],onUpdateValue:[Function,Array],onClose:[Function,Array],labelSize:String,activeName:[String,Number],onActiveNameChange:[Function,Array]}),Aa=ae({name:"Tabs",props:Ba,slots:Object,setup(e,{slots:o}){var d,v,c,x;const{mergedClsPrefixRef:g,inlineThemeDisabled:u,mergedComponentPropsRef:m}=Qt(e),h=qe("Tabs","-tabs",Ea,da,e,g),p=T(null),C=T(null),P=T(null),_=T(null),y=T(null),w=T(null),k=T(!0),$=T(!0),R=Le(e,["labelSize","size"]),B=te(()=>{var t,a;if(R.value)return R.value;const s=(a=(t=m?.value)===null||t===void 0?void 0:t.Tabs)===null||a===void 0?void 0:a.size;return s||"medium"}),j=Le(e,["activeName","value"]),i=T((v=(d=j.value)!==null&&d!==void 0?d:e.defaultValue)!==null&&v!==void 0?v:o.default?(x=(c=ge(o.default())[0])===null||c===void 0?void 0:c.props)===null||x===void 0?void 0:x.name:null),r=ca(j,i),L={id:0},N=te(()=>{if(!(!e.justifyContent||e.type==="card"))return{display:"flex",justifyContent:e.justifyContent}});de(r,()=>{L.id=0,U(),oe()});function I(){var t;const{value:a}=r;return a===null?null:(t=p.value)===null||t===void 0?void 0:t.querySelector(`[data-name="${a}"]`)}function be(t){if(e.type==="card")return;const{value:a}=C;if(!a)return;const s=a.style.opacity==="0";if(t){const b=`${g.value}-tabs-bar--disabled`,{barWidth:z,placement:q}=e;if(t.dataset.disabled==="true"?a.classList.add(b):a.classList.remove(b),["top","bottom"].includes(q)){if(ne(["top","maxHeight","height"]),typeof z=="number"&&t.offsetWidth>=z){const H=Math.floor((t.offsetWidth-z)/2)+t.offsetLeft;a.style.left=`${H}px`,a.style.maxWidth=`${z}px`}else a.style.left=`${t.offsetLeft}px`,a.style.maxWidth=`${t.offsetWidth}px`;a.style.width="8192px",s&&(a.style.transition="none"),a.offsetWidth,s&&(a.style.transition="",a.style.opacity="1")}else{if(ne(["left","maxWidth","width"]),typeof z=="number"&&t.offsetHeight>=z){const H=Math.floor((t.offsetHeight-z)/2)+t.offsetTop;a.style.top=`${H}px`,a.style.maxHeight=`${z}px`}else a.style.top=`${t.offsetTop}px`,a.style.maxHeight=`${t.offsetHeight}px`;a.style.height="8192px",s&&(a.style.transition="none"),a.offsetHeight,s&&(a.style.transition="",a.style.opacity="1")}}}function re(){if(e.type==="card")return;const{value:t}=C;t&&(t.style.opacity="0")}function ne(t){const{value:a}=C;if(a)for(const s of t)a.style[s]=""}function U(){if(e.type==="card")return;const t=I();t?be(t):re()}function oe(){var t;const a=(t=y.value)===null||t===void 0?void 0:t.$el;if(!a)return;const s=I();if(!s)return;const{scrollLeft:b,offsetWidth:z}=a,{offsetLeft:q,offsetWidth:H}=s;b>q?a.scrollTo({top:0,left:q,behavior:"smooth"}):q+H>b+z&&a.scrollTo({top:0,left:q+H-z,behavior:"smooth"})}const O=T(null);let fe=0,V=null;function Fe(t){const a=O.value;if(a){fe=t.getBoundingClientRect().height;const s=`${fe}px`,b=()=>{a.style.height=s,a.style.maxHeight=s};V?(b(),V(),V=null):V=b}}function Ne(t){const a=O.value;if(a){const s=t.getBoundingClientRect().height,b=()=>{document.body.offsetHeight,a.style.maxHeight=`${s}px`,a.style.height=`${Math.max(fe,s)}px`};V?(V(),V=null,b()):V=b}}function Me(){const t=O.value;if(t){t.style.maxHeight="",t.style.height="";const{paneWrapperStyle:a}=e;if(typeof a=="string")t.style.cssText=a;else if(a){const{maxHeight:s,height:b}=a;s!==void 0&&(t.style.maxHeight=s),b!==void 0&&(t.style.height=b)}}}const Ce={value:[]},Re=T("next");function De(t){const a=r.value;let s="next";for(const b of Ce.value){if(b===a)break;if(b===t){s="prev";break}}Re.value=s,Ve(t)}function Ve(t){const{onActiveNameChange:a,onUpdateValue:s,"onUpdate:value":b}=e;a&&le(a,t),s&&le(s,t),b&&le(b,t),i.value=t}function Ue(t){const{onClose:a}=e;a&&le(a,t)}function Te(){const{value:t}=C;if(!t)return;const a="transition-disabled";t.classList.add(a),U(),t.classList.remove(a)}const X=T(null);function ue({transitionDisabled:t}){const a=p.value;if(!a)return;t&&a.classList.add("transition-disabled");const s=I();s&&X.value&&(X.value.style.width=`${s.offsetWidth}px`,X.value.style.height=`${s.offsetHeight}px`,X.value.style.transform=`translateX(${s.offsetLeft-Jt(getComputedStyle(a).paddingLeft)}px)`,t&&X.value.offsetWidth),t&&a.classList.remove("transition-disabled")}de([r],()=>{e.type==="segment"&&ve(()=>{ue({transitionDisabled:!1})})}),Rt(()=>{e.type==="segment"&&ue({transitionDisabled:!0})});let ze=0;function Xe(t){var a;if(t.contentRect.width===0&&t.contentRect.height===0||ze===t.contentRect.width)return;ze=t.contentRect.width;const{type:s}=e;if((s==="line"||s==="bar")&&Te(),s!=="segment"){const{placement:b}=e;pe((b==="top"||b==="bottom"?(a=y.value)===null||a===void 0?void 0:a.$el:w.value)||null)}}const Ge=ye(Xe,64);de([()=>e.justifyContent,()=>e.size],()=>{ve(()=>{const{type:t}=e;(t==="line"||t==="bar")&&Te()})});const G=T(!1);function Ke(t){var a;const{target:s,contentRect:{width:b,height:z}}=t,q=s.parentElement.parentElement.offsetWidth,H=s.parentElement.parentElement.offsetHeight,{placement:Q}=e;if(!G.value)Q==="top"||Q==="bottom"?q<b&&(G.value=!0):H<z&&(G.value=!0);else{const{value:ee}=_;if(!ee)return;Q==="top"||Q==="bottom"?q-b>ee.$el.offsetWidth&&(G.value=!1):H-z>ee.$el.offsetHeight&&(G.value=!1)}pe(((a=y.value)===null||a===void 0?void 0:a.$el)||null)}const Qe=ye(Ke,64);function Ye(){const{onAdd:t}=e;t&&t(),ve(()=>{const a=I(),{value:s}=y;!a||!s||s.scrollTo({left:a.offsetLeft,top:0,behavior:"smooth"})})}function pe(t){if(!t)return;const{placement:a}=e;if(a==="top"||a==="bottom"){const{scrollLeft:s,scrollWidth:b,offsetWidth:z}=t;k.value=s<=0,$.value=s+z>=b}else{const{scrollTop:s,scrollHeight:b,offsetHeight:z}=t;k.value=s<=0,$.value=s+z>=b}}const Je=ye(t=>{pe(t.target)},64);Lt(Se,{triggerRef:M(e,"trigger"),tabStyleRef:M(e,"tabStyle"),tabClassRef:M(e,"tabClass"),addTabStyleRef:M(e,"addTabStyle"),addTabClassRef:M(e,"addTabClass"),paneClassRef:M(e,"paneClass"),paneStyleRef:M(e,"paneStyle"),mergedClsPrefixRef:g,typeRef:M(e,"type"),closableRef:M(e,"closable"),valueRef:r,tabChangeIdRef:L,onBeforeLeaveRef:M(e,"onBeforeLeave"),activateTab:De,handleClose:Ue,handleAdd:Ye}),ia(()=>{U(),oe()}),Tt(()=>{const{value:t}=P;if(!t)return;const{value:a}=g,s=`${a}-tabs-nav-scroll-wrapper--shadow-start`,b=`${a}-tabs-nav-scroll-wrapper--shadow-end`;k.value?t.classList.remove(s):t.classList.add(s),$.value?t.classList.remove(b):t.classList.add(b)});const Ze={syncBarPosition:()=>{U()}},et=()=>{ue({transitionDisabled:!0})},$e=te(()=>{const{value:t}=B,{type:a}=e,s={card:"Card",bar:"Bar",line:"Line",segment:"Segment"}[a],b=`${t}${s}`,{self:{barColor:z,closeIconColor:q,closeIconColorHover:H,closeIconColorPressed:Q,tabColor:ee,tabBorderColor:tt,paneTextColor:at,tabFontWeight:rt,tabBorderRadius:nt,tabFontWeightActive:ot,colorSegment:st,fontWeightStrong:it,tabColorSegment:lt,closeSize:dt,closeIconSize:ct,closeColorHover:bt,closeColorPressed:ft,closeBorderRadius:ut,[D("panePadding",t)]:se,[D("tabPadding",b)]:pt,[D("tabPaddingVertical",b)]:vt,[D("tabGap",b)]:gt,[D("tabGap",`${b}Vertical`)]:ht,[D("tabTextColor",a)]:mt,[D("tabTextColorActive",a)]:xt,[D("tabTextColorHover",a)]:yt,[D("tabTextColorDisabled",a)]:wt,[D("tabFontSize",t)]:_t},common:{cubicBezierEaseInOut:St}}=h.value;return{"--n-bezier":St,"--n-color-segment":st,"--n-bar-color":z,"--n-tab-font-size":_t,"--n-tab-text-color":mt,"--n-tab-text-color-active":xt,"--n-tab-text-color-disabled":wt,"--n-tab-text-color-hover":yt,"--n-pane-text-color":at,"--n-tab-border-color":tt,"--n-tab-border-radius":nt,"--n-close-size":dt,"--n-close-icon-size":ct,"--n-close-color-hover":bt,"--n-close-color-pressed":ft,"--n-close-border-radius":ut,"--n-close-icon-color":q,"--n-close-icon-color-hover":H,"--n-close-icon-color-pressed":Q,"--n-tab-color":ee,"--n-tab-font-weight":rt,"--n-tab-font-weight-active":ot,"--n-tab-padding":pt,"--n-tab-padding-vertical":vt,"--n-tab-gap":gt,"--n-tab-gap-vertical":ht,"--n-pane-padding-left":ie(se,"left"),"--n-pane-padding-right":ie(se,"right"),"--n-pane-padding-top":ie(se,"top"),"--n-pane-padding-bottom":ie(se,"bottom"),"--n-font-weight-strong":it,"--n-tab-color-segment":lt}}),K=u?Yt("tabs",te(()=>`${B.value[0]}${e.type[0]}`),$e,e):void 0;return Object.assign({mergedClsPrefix:g,mergedValue:r,renderedNames:new Set,segmentCapsuleElRef:X,tabsPaneWrapperRef:O,tabsElRef:p,barElRef:C,addTabInstRef:_,xScrollInstRef:y,scrollWrapperElRef:P,addTabFixed:G,tabWrapperStyle:N,handleNavResize:Ge,mergedSize:B,handleScroll:Je,handleTabsResize:Qe,cssVars:u?void 0:$e,themeClass:K?.themeClass,animationDirection:Re,renderNameListRef:Ce,yScrollElRef:w,handleSegmentResize:et,onAnimationBeforeLeave:Fe,onAnimationEnter:Ne,onAnimationAfterEnter:Me,onRender:K?.onRender},Ze)},render(){const{mergedClsPrefix:e,type:o,placement:d,addTabFixed:v,addable:c,mergedSize:x,renderNameListRef:g,onRender:u,paneWrapperClass:m,paneWrapperStyle:h,$slots:{default:p,prefix:C,suffix:P}}=this;u?.();const _=p?ge(p()).filter(i=>i.type.__TAB_PANE__===!0):[],y=p?ge(p()).filter(i=>i.type.__TAB__===!0):[],w=!y.length,k=o==="card",$=o==="segment",R=!k&&!$&&this.justifyContent;g.value=[];const B=()=>{const i=f("div",{style:this.tabWrapperStyle,class:`${e}-tabs-wrapper`},R?null:f("div",{class:`${e}-tabs-scroll-padding`,style:d==="top"||d==="bottom"?{width:`${this.tabsPadding}px`}:{height:`${this.tabsPadding}px`}}),w?_.map((r,L)=>(g.value.push(r.props.name),we(f(_e,Object.assign({},r.props,{internalCreatedByPane:!0,internalLeftPadded:L!==0&&(!R||R==="center"||R==="start"||R==="end")}),r.children?{default:r.children.tab}:void 0)))):y.map((r,L)=>(g.value.push(r.props.name),we(L!==0&&!R?je(r):r))),!v&&c&&k?Ae(c,(w?_.length:y.length)!==0):null,R?null:f("div",{class:`${e}-tabs-scroll-padding`,style:{width:`${this.tabsPadding}px`}}));return f("div",{ref:"tabsElRef",class:`${e}-tabs-nav-scroll-content`},k&&c?f(he,{onResize:this.handleTabsResize},{default:()=>i}):i,k?f("div",{class:`${e}-tabs-pad`}):null,k?null:f("div",{ref:"barElRef",class:`${e}-tabs-bar`}))},j=$?"top":d;return f("div",{class:[`${e}-tabs`,this.themeClass,`${e}-tabs--${o}-type`,`${e}-tabs--${x}-size`,R&&`${e}-tabs--flex`,`${e}-tabs--${j}`],style:this.cssVars},f("div",{class:[`${e}-tabs-nav--${o}-type`,`${e}-tabs-nav--${j}`,`${e}-tabs-nav`]},Pe(C,i=>i&&f("div",{class:`${e}-tabs-nav__prefix`},i)),$?f(he,{onResize:this.handleSegmentResize},{default:()=>f("div",{class:`${e}-tabs-rail`,ref:"tabsElRef"},f("div",{class:`${e}-tabs-capsule`,ref:"segmentCapsuleElRef"},f("div",{class:`${e}-tabs-wrapper`},f("div",{class:`${e}-tabs-tab`}))),w?_.map((i,r)=>(g.value.push(i.props.name),f(_e,Object.assign({},i.props,{internalCreatedByPane:!0,internalLeftPadded:r!==0}),i.children?{default:i.children.tab}:void 0))):y.map((i,r)=>(g.value.push(i.props.name),r===0?i:je(i))))}):f(he,{onResize:this.handleNavResize},{default:()=>f("div",{class:`${e}-tabs-nav-scroll-wrapper`,ref:"scrollWrapperElRef"},["top","bottom"].includes(j)?f(ga,{ref:"xScrollInstRef",onScroll:this.handleScroll},{default:B}):f("div",{class:`${e}-tabs-nav-y-scroll`,onScroll:this.handleScroll,ref:"yScrollElRef"},B()))}),v&&c&&k?Ae(c,!0):null,Pe(P,i=>i&&f("div",{class:`${e}-tabs-nav__suffix`},i))),w&&(this.animated&&(j==="top"||j==="bottom")?f("div",{ref:"tabsPaneWrapperRef",style:h,class:[`${e}-tabs-pane-wrapper`,m]},Be(_,this.mergedValue,this.renderedNames,this.onAnimationBeforeLeave,this.onAnimationEnter,this.onAnimationAfterEnter,this.animationDirection)):Be(_,this.mergedValue,this.renderedNames)))}});function Be(e,o,d,v,c,x,g){const u=[];return e.forEach(m=>{const{name:h,displayDirective:p,"display-directive":C}=m.props,P=y=>p===y||C===y,_=o===h;if(m.key!==void 0&&(m.key=h),_||P("show")||P("show:lazy")&&d.has(h)){d.has(h)||d.add(h);const y=!P("if");u.push(y?zt(m,[[kt,_]]):m)}}),g?f($t,{name:`${g}-transition`,onBeforeLeave:v,onEnter:c,onAfterEnter:x},{default:()=>u}):u}function Ae(e,o){return f(_e,{ref:"addTabInstRef",key:"__addable",name:"__addable",internalCreatedByPane:!0,internalAddable:!0,internalLeftPadded:o,disabled:typeof e=="object"&&e.disabled})}function je(e){const o=Pt(e);return o.props?o.props.internalLeftPadded=!0:o.props={internalLeftPadded:!0},o}function we(e){return Array.isArray(e.dynamicProps)?e.dynamicProps.includes("internalLeftPadded")||e.dynamicProps.push("internalLeftPadded"):e.dynamicProps=["internalLeftPadded"],e}const ja={class:"login-page"},Ia={class:"login-intro"},Oa={class:"intro-content"},qa=["src"],Ha={class:"login-panel"},Fa={class:"qr-login"},Na={key:0,class:"qr-state"},Ma=["src"],Da={key:2,class:"qr-state qr-error"},Va={key:3,class:"qr-state qr-error"},Ua={key:4,class:"qr-state qr-error"},Xa=ae({__name:"LoginView",setup(e){const o=Bt(),d=At(),v=Zt(),c=na(),x=T(null),g=T(!1),u=qt({username:"",password:""}),m={username:{required:!0,message:"请输入用户名",trigger:"blur"},password:{required:!0,message:"请输入密码",trigger:"blur"}},h=T("qr"),p=T("idle"),C=T(""),P=T(!1),_=T("");let y,w=!1;async function k(){await o.replace(d.query.redirect?String(d.query.redirect):{name:ta(i=>v.can(i))})}async function $(){await x.value?.validate(),g.value=!0;try{await v.login(u),await k()}catch(i){c.error(i instanceof Error?i.message:"登录失败")}finally{g.value=!1}}function R(){y!==void 0&&(window.clearTimeout(y),y=void 0)}async function B(){R(),_.value="",C.value="",P.value=!1,p.value="loading";try{const i=await me.createQrSession();if(w||h.value!=="qr")return;_.value=i.session_id,C.value=me.qrCodeUrl(i.session_id),p.value="ready",j()}catch{p.value="error"}}async function j(){const i=_.value;if(!(!i||w||h.value!=="qr")){try{const r=await me.qrSession(i);if(r.status==="confirmed"&&r.access_token&&r.refresh_token&&r.user){v.adoptSession({access_token:r.access_token,refresh_token:r.refresh_token,user:r.user}),R(),await k();return}if(r.status==="expired"){p.value="expired";return}}catch{}!w&&h.value==="qr"&&(y=window.setTimeout(()=>{j()},1500))}}return de(h,i=>{i==="qr"?B():(R(),p.value="idle")}),B(),Wt(()=>{w=!0,R()}),(i,r)=>{const L=la,N=fa,I=aa,be=ba,re=La,ne=ua,U=Aa,oe=ea;return Z(),Y("main",ja,[E("section",Ia,[E("div",Oa,[E("img",{class:"login-logo",src:Et(ra),alt:"系统 Logo"},null,8,qa),r[4]||(r[4]=E("span",{class:"eyebrow"},"ELECTRICAL WORKSHOP",-1)),r[5]||(r[5]=E("h1",null,[J("HXNI"),E("br"),J("电气无忧")],-1))])]),E("section",Ha,[A(oe,{class:"login-card",bordered:!1},{default:F(()=>[r[16]||(r[16]=E("h2",null,"欢迎登录",-1)),A(U,{value:h.value,"onUpdate:value":r[3]||(r[3]=O=>h.value=O),type:"segment",animated:""},{default:F(()=>[A(re,{name:"password",tab:"账号密码"},{default:F(()=>[A(be,{ref_key:"formRef",ref:x,model:u,rules:m,size:"large",onSubmit:jt($,["prevent"])},{default:F(()=>[A(N,{label:"用户名",path:"username"},{default:F(()=>[A(L,{value:u.username,"onUpdate:value":r[0]||(r[0]=O=>u.username=O),placeholder:"用户名"},null,8,["value"])]),_:1}),A(N,{label:"密码",path:"password"},{default:F(()=>[A(L,{value:u.password,"onUpdate:value":r[1]||(r[1]=O=>u.password=O),type:"password","show-password-on":"click",placeholder:"密码",onKeyup:It($,["enter"])},null,8,["value"])]),_:1}),A(I,{type:"primary",block:"",size:"large",loading:g.value,onClick:$},{default:F(()=>[...r[6]||(r[6]=[J("登录",-1)])]),_:1},8,["loading"])]),_:1},8,["model"])]),_:1}),A(re,{name:"qr",tab:"小程序扫码"},{default:F(()=>[E("div",Fa,[p.value==="loading"?(Z(),Y("div",Na,[A(ne,{size:"small"}),r[7]||(r[7]=E("span",null,"正在生成二维码…",-1))])):p.value==="ready"&&!P.value?(Z(),Y(Oe,{key:1},[E("img",{class:"qr-image",src:C.value,alt:"小程序扫码登录二维码",onError:r[2]||(r[2]=O=>P.value=!0)},null,40,Ma),r[8]||(r[8]=E("p",{class:"qr-hint"},"请使用微信扫一扫，在小程序中确认登录",-1)),r[9]||(r[9]=E("p",{class:"qr-subhint"},"二维码 5 分钟内有效",-1))],64)):p.value==="ready"?(Z(),Y("div",Da,[r[11]||(r[11]=E("p",null,"二维码生成失败，请重试或使用账号密码登录。",-1)),A(I,{size:"small",onClick:B},{default:F(()=>[...r[10]||(r[10]=[J("重新生成",-1)])]),_:1})])):p.value==="expired"?(Z(),Y("div",Va,[r[13]||(r[13]=E("p",null,"二维码已过期",-1)),A(I,{size:"small",type:"primary",secondary:"",onClick:B},{default:F(()=>[...r[12]||(r[12]=[J("刷新二维码",-1)])]),_:1})])):p.value==="error"?(Z(),Y("div",Ua,[r[15]||(r[15]=E("p",null,"扫码登录暂时不可用，请使用账号密码登录。",-1)),A(I,{size:"small",onClick:B},{default:F(()=>[...r[14]||(r[14]=[J("重试",-1)])]),_:1})])):Ot("",!0)])]),_:1})]),_:1},8,["value"])]),_:1})])])}}}),cr=pa(Xa,[["__scopeId","data-v-4659ea9a"]]);export{cr as default};
