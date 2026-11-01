import{j as $,k as s,B as Me,q as eo,v as oo,D as Ue,r as j,n as $e,w as So,b as _o,c as w,i as Z,p as q,t as le,F as to,P as F,Q as K,a3 as pe,$ as R,a4 as Io,R as ne,S as X,E as ro,V as W,L as G,a5 as Oe,a6 as te,O as Ro,a7 as Ve,a8 as Mo,a0 as $o,U as Oo}from"./vendor-vue-Bmd4nGA4.js";import{F as To,S as Be,b as ae,c as Eo,d as Po,e as no,f as Bo,g as No,p as Ao,m as Ho,h as m,i as ge,j as h,k as S,l as v,n as Fo,L as Lo,o as jo,q as J,s as Do,t as ue,z as Ko,v as Uo,w as D,x as Vo,y as Wo,A as Yo,C as We,D as he,E as io,N as lo,G as se,H as Go,I as ie,J as Ne,K as Te,M as Ie,O as Xo,V as qo,P as Jo,T as ao,u as so,Q as Qo,R as Zo,U as et,a as ot,W as tt}from"./index-CUYPwxSu.js";import{N as fe}from"./Icon-KZwzWdGB.js";import{D as rt,C as Ye,a as nt,W as it}from"./WarningOutline-CCoXreKs.js";import{C as lt,_ as co}from"./Dropdown-C2q5Lecr.js";import{_ as uo}from"./_plugin-vue_export-helper-DlAUqK2U.js";import{a as Ge}from"./branding-B1ud1g9H.js";import{u as de}from"./get-DVk_cyji.js";import{d as at,m as st}from"./light-88j7U5Zm.js";import{f as ce}from"./format-length-B-p6aW7q.js";import{N as ct}from"./Tooltip-BoaNLCaQ.js";import{V as dt,u as ut,c as Re}from"./Popover-DI2QS4-0.js";import"./light-PSzKgDNF.js";import"./use-keyboard-BgTEXnrB.js";import"./light-DP1o9a3r.js";import"./light-D9LgJ1x3.js";import"./light-DnfDvUeY.js";const ht=$({name:"ChevronDownFilled",render(){return s("svg",{viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg"},s("path",{d:"M3.20041 5.73966C3.48226 5.43613 3.95681 5.41856 4.26034 5.70041L8 9.22652L11.7397 5.70041C12.0432 5.41856 12.5177 5.43613 12.7996 5.73966C13.0815 6.0432 13.0639 6.51775 12.7603 6.7996L8.51034 10.7996C8.22258 11.0668 7.77743 11.0668 7.48967 10.7996L3.23966 6.7996C2.93613 6.51775 2.91856 6.0432 3.20041 5.73966Z",fill:"currentColor"}))}}),mt=$({name:"NDrawerContent",inheritAttrs:!1,props:{blockScroll:Boolean,show:{type:Boolean,default:void 0},displayDirective:{type:String,required:!0},placement:{type:String,required:!0},contentClass:String,contentStyle:[Object,String],nativeScrollbar:{type:Boolean,required:!0},scrollbarProps:Object,trapFocus:{type:Boolean,default:!0},autoFocus:{type:Boolean,default:!0},showMask:{type:[Boolean,String],required:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,onClickoutside:Function,onAfterLeave:Function,onAfterEnter:Function,onEsc:Function},setup(e){const o=j(!!e.show),t=j(null),i=Z(no);let n=0,a="",c=null;const f=j(!1),u=j(!1),x=w(()=>e.placement==="top"||e.placement==="bottom"),{mergedClsPrefixRef:E,mergedRtlRef:C}=ae(e),g=Eo("Drawer",C,E),O=d,P=k=>{u.value=!0,n=x.value?k.clientY:k.clientX,a=document.body.style.cursor,document.body.style.cursor=x.value?"ns-resize":"ew-resize",document.body.addEventListener("mousemove",z),document.body.addEventListener("mouseleave",O),document.body.addEventListener("mouseup",d)},_=()=>{c!==null&&(window.clearTimeout(c),c=null),u.value?f.value=!0:c=window.setTimeout(()=>{f.value=!0},300)},M=()=>{c!==null&&(window.clearTimeout(c),c=null),f.value=!1},{doUpdateHeight:B,doUpdateWidth:Y}=i,U=k=>{const{maxWidth:L}=e;if(L&&k>L)return L;const{minWidth:T}=e;return T&&k<T?T:k},A=k=>{const{maxHeight:L}=e;if(L&&k>L)return L;const{minHeight:T}=e;return T&&k<T?T:k};function z(k){var L,T;if(u.value)if(x.value){let V=((L=t.value)===null||L===void 0?void 0:L.offsetHeight)||0;const Q=n-k.clientY;V+=e.placement==="bottom"?Q:-Q,V=A(V),B(V),n=k.clientY}else{let V=((T=t.value)===null||T===void 0?void 0:T.offsetWidth)||0;const Q=n-k.clientX;V+=e.placement==="right"?Q:-Q,V=U(V),Y(V),n=k.clientX}}function d(){u.value&&(n=0,u.value=!1,document.body.style.cursor=a,document.body.removeEventListener("mousemove",z),document.body.removeEventListener("mouseup",d),document.body.removeEventListener("mouseleave",O))}$e(()=>{e.show&&(o.value=!0)}),So(()=>e.show,k=>{k||d()}),_o(()=>{d()});const p=w(()=>{const{show:k}=e,L=[[Ue,k]];return e.showMask||L.push([Bo,e.onClickoutside,void 0,{capture:!0}]),L});function H(){var k;o.value=!1,(k=e.onAfterLeave)===null||k===void 0||k.call(e)}return Po(w(()=>e.blockScroll&&o.value)),q(No,t),q(Ao,null),q(Ho,null),{bodyRef:t,rtlEnabled:g,mergedClsPrefix:i.mergedClsPrefixRef,isMounted:i.isMountedRef,mergedTheme:i.mergedThemeRef,displayed:o,transitionName:w(()=>({right:"slide-in-from-right-transition",left:"slide-in-from-left-transition",top:"slide-in-from-top-transition",bottom:"slide-in-from-bottom-transition"})[e.placement]),handleAfterLeave:H,bodyDirectives:p,handleMousedownResizeTrigger:P,handleMouseenterResizeTrigger:_,handleMouseleaveResizeTrigger:M,isDragging:u,isHoverOnResizeTrigger:f}},render(){const{$slots:e,mergedClsPrefix:o}=this;return this.displayDirective==="show"||this.displayed||this.show?Me(s("div",{role:"none"},s(To,{disabled:!this.showMask||!this.trapFocus,active:this.show,autoFocus:this.autoFocus,onEsc:this.onEsc},{default:()=>s(eo,{name:this.transitionName,appear:this.isMounted,onAfterEnter:this.onAfterEnter,onAfterLeave:this.handleAfterLeave},{default:()=>Me(s("div",oo(this.$attrs,{role:"dialog",ref:"bodyRef","aria-modal":"true",class:[`${o}-drawer`,this.rtlEnabled&&`${o}-drawer--rtl`,`${o}-drawer--${this.placement}-placement`,this.isDragging&&`${o}-drawer--unselectable`,this.nativeScrollbar&&`${o}-drawer--native-scrollbar`]}),[this.resizable?s("div",{class:[`${o}-drawer__resize-trigger`,(this.isDragging||this.isHoverOnResizeTrigger)&&`${o}-drawer__resize-trigger--hover`],onMouseenter:this.handleMouseenterResizeTrigger,onMouseleave:this.handleMouseleaveResizeTrigger,onMousedown:this.handleMousedownResizeTrigger}):null,this.nativeScrollbar?s("div",{class:[`${o}-drawer-content-wrapper`,this.contentClass],style:this.contentStyle,role:"none"},e):s(Be,Object.assign({},this.scrollbarProps,{contentStyle:this.contentStyle,contentClass:[`${o}-drawer-content-wrapper`,this.contentClass],theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar}),e)]),this.bodyDirectives)})})),[[Ue,this.displayDirective==="if"||this.displayed||this.show]]):null}}),{cubicBezierEaseIn:vt,cubicBezierEaseOut:ft}=ge;function pt({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-bottom"}={}){return[m(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${vt}`}),m(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${ft}`}),m(`&.${t}-transition-enter-to`,{transform:"translateY(0)"}),m(`&.${t}-transition-enter-from`,{transform:"translateY(100%)"}),m(`&.${t}-transition-leave-from`,{transform:"translateY(0)"}),m(`&.${t}-transition-leave-to`,{transform:"translateY(100%)"})]}const{cubicBezierEaseIn:gt,cubicBezierEaseOut:bt}=ge;function xt({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-left"}={}){return[m(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${gt}`}),m(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${bt}`}),m(`&.${t}-transition-enter-to`,{transform:"translateX(0)"}),m(`&.${t}-transition-enter-from`,{transform:"translateX(-100%)"}),m(`&.${t}-transition-leave-from`,{transform:"translateX(0)"}),m(`&.${t}-transition-leave-to`,{transform:"translateX(-100%)"})]}const{cubicBezierEaseIn:wt,cubicBezierEaseOut:Ct}=ge;function yt({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-right"}={}){return[m(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${wt}`}),m(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${Ct}`}),m(`&.${t}-transition-enter-to`,{transform:"translateX(0)"}),m(`&.${t}-transition-enter-from`,{transform:"translateX(100%)"}),m(`&.${t}-transition-leave-from`,{transform:"translateX(0)"}),m(`&.${t}-transition-leave-to`,{transform:"translateX(100%)"})]}const{cubicBezierEaseIn:kt,cubicBezierEaseOut:zt}=ge;function St({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-top"}={}){return[m(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${kt}`}),m(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${zt}`}),m(`&.${t}-transition-enter-to`,{transform:"translateY(0)"}),m(`&.${t}-transition-enter-from`,{transform:"translateY(-100%)"}),m(`&.${t}-transition-leave-from`,{transform:"translateY(0)"}),m(`&.${t}-transition-leave-to`,{transform:"translateY(-100%)"})]}const _t=m([h("drawer",`
 word-break: break-word;
 line-height: var(--n-line-height);
 position: absolute;
 pointer-events: all;
 box-shadow: var(--n-box-shadow);
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 background-color: var(--n-color);
 color: var(--n-text-color);
 box-sizing: border-box;
 `,[yt(),xt(),St(),pt(),S("unselectable",`
 user-select: none; 
 -webkit-user-select: none;
 `),S("native-scrollbar",[h("drawer-content-wrapper",`
 overflow: auto;
 height: 100%;
 `)]),v("resize-trigger",`
 position: absolute;
 background-color: #0000;
 transition: background-color .3s var(--n-bezier);
 `,[S("hover",`
 background-color: var(--n-resize-trigger-color-hover);
 `)]),h("drawer-content-wrapper",`
 box-sizing: border-box;
 `),h("drawer-content",`
 height: 100%;
 display: flex;
 flex-direction: column;
 `,[S("native-scrollbar",[h("drawer-body-content-wrapper",`
 height: 100%;
 overflow: auto;
 `)]),h("drawer-body",`
 flex: 1 0 0;
 overflow: hidden;
 `),h("drawer-body-content-wrapper",`
 box-sizing: border-box;
 padding: var(--n-body-padding);
 `),h("drawer-header",`
 font-weight: var(--n-title-font-weight);
 line-height: 1;
 font-size: var(--n-title-font-size);
 color: var(--n-title-text-color);
 padding: var(--n-header-padding);
 transition: border .3s var(--n-bezier);
 border-bottom: 1px solid var(--n-divider-color);
 border-bottom: var(--n-header-border-bottom);
 display: flex;
 justify-content: space-between;
 align-items: center;
 `,[v("main",`
 flex: 1;
 `),v("close",`
 margin-left: 6px;
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `)]),h("drawer-footer",`
 display: flex;
 justify-content: flex-end;
 border-top: var(--n-footer-border-top);
 transition: border .3s var(--n-bezier);
 padding: var(--n-footer-padding);
 `)]),S("right-placement",`
 top: 0;
 bottom: 0;
 right: 0;
 border-top-left-radius: var(--n-border-radius);
 border-bottom-left-radius: var(--n-border-radius);
 `,[v("resize-trigger",`
 width: 3px;
 height: 100%;
 top: 0;
 left: 0;
 transform: translateX(-1.5px);
 cursor: ew-resize;
 `)]),S("left-placement",`
 top: 0;
 bottom: 0;
 left: 0;
 border-top-right-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `,[v("resize-trigger",`
 width: 3px;
 height: 100%;
 top: 0;
 right: 0;
 transform: translateX(1.5px);
 cursor: ew-resize;
 `)]),S("top-placement",`
 top: 0;
 left: 0;
 right: 0;
 border-bottom-left-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `,[v("resize-trigger",`
 width: 100%;
 height: 3px;
 bottom: 0;
 left: 0;
 transform: translateY(1.5px);
 cursor: ns-resize;
 `)]),S("bottom-placement",`
 left: 0;
 bottom: 0;
 right: 0;
 border-top-left-radius: var(--n-border-radius);
 border-top-right-radius: var(--n-border-radius);
 `,[v("resize-trigger",`
 width: 100%;
 height: 3px;
 top: 0;
 left: 0;
 transform: translateY(-1.5px);
 cursor: ns-resize;
 `)])]),m("body",[m(">",[h("drawer-container",`
 position: fixed;
 `)])]),h("drawer-container",`
 position: relative;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 pointer-events: none;
 `,[m("> *",`
 pointer-events: all;
 `)]),h("drawer-mask",`
 background-color: rgba(0, 0, 0, .3);
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `,[S("invisible",`
 background-color: rgba(0, 0, 0, 0)
 `),Fo({enterDuration:"0.2s",leaveDuration:"0.2s",enterCubicBezier:"var(--n-bezier-in)",leaveCubicBezier:"var(--n-bezier-out)"})])]),It=Object.assign(Object.assign({},J.props),{show:Boolean,width:[Number,String],height:[Number,String],placement:{type:String,default:"right"},maskClosable:{type:Boolean,default:!0},showMask:{type:[Boolean,String],default:!0},to:[String,Object],displayDirective:{type:String,default:"if"},nativeScrollbar:{type:Boolean,default:!0},zIndex:Number,onMaskClick:Function,scrollbarProps:Object,contentClass:String,contentStyle:[Object,String],trapFocus:{type:Boolean,default:!0},onEsc:Function,autoFocus:{type:Boolean,default:!0},closeOnEsc:{type:Boolean,default:!0},blockScroll:{type:Boolean,default:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,defaultWidth:{type:[Number,String],default:251},defaultHeight:{type:[Number,String],default:251},onUpdateWidth:[Function,Array],onUpdateHeight:[Function,Array],"onUpdate:width":[Function,Array],"onUpdate:height":[Function,Array],"onUpdate:show":[Function,Array],onUpdateShow:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,drawerStyle:[String,Object],drawerClass:String,target:null,onShow:Function,onHide:Function}),Rt=$({name:"Drawer",inheritAttrs:!1,props:It,setup(e){const{mergedClsPrefixRef:o,namespaceRef:t,inlineThemeDisabled:i}=ae(e),n=jo(),a=J("Drawer","-drawer",_t,at,e,o),c=j(e.defaultWidth),f=j(e.defaultHeight),u=de(le(e,"width"),c),x=de(le(e,"height"),f),E=w(()=>{const{placement:d}=e;return d==="top"||d==="bottom"?"":ce(u.value)}),C=w(()=>{const{placement:d}=e;return d==="left"||d==="right"?"":ce(x.value)}),g=d=>{const{onUpdateWidth:p,"onUpdate:width":H}=e;p&&D(p,d),H&&D(H,d),c.value=d},O=d=>{const{onUpdateHeight:p,"onUpdate:width":H}=e;p&&D(p,d),H&&D(H,d),f.value=d},P=w(()=>[{width:E.value,height:C.value},e.drawerStyle||""]);function _(d){const{onMaskClick:p,maskClosable:H}=e;H&&U(!1),p&&p(d)}function M(d){_(d)}const B=Do();function Y(d){var p;(p=e.onEsc)===null||p===void 0||p.call(e),e.show&&e.closeOnEsc&&Uo(d)&&(B.value||U(!1))}function U(d){const{onHide:p,onUpdateShow:H,"onUpdate:show":k}=e;H&&D(H,d),k&&D(k,d),p&&!d&&D(p,d)}q(no,{isMountedRef:n,mergedThemeRef:a,mergedClsPrefixRef:o,doUpdateShow:U,doUpdateHeight:O,doUpdateWidth:g});const A=w(()=>{const{common:{cubicBezierEaseInOut:d,cubicBezierEaseIn:p,cubicBezierEaseOut:H},self:{color:k,textColor:L,boxShadow:T,lineHeight:V,headerPadding:Q,footerPadding:re,borderRadius:be,bodyPadding:xe,titleFontSize:we,titleTextColor:Ce,titleFontWeight:ye,headerBorderBottom:ke,footerBorderTop:b,closeIconColor:I,closeIconColorHover:r,closeIconColorPressed:y,closeColorHover:N,closeColorPressed:ze,closeIconSize:Se,closeSize:_e,closeBorderRadius:l,resizableTriggerColorHover:zo}}=a.value;return{"--n-line-height":V,"--n-color":k,"--n-border-radius":be,"--n-text-color":L,"--n-box-shadow":T,"--n-bezier":d,"--n-bezier-out":H,"--n-bezier-in":p,"--n-header-padding":Q,"--n-body-padding":xe,"--n-footer-padding":re,"--n-title-text-color":Ce,"--n-title-font-size":we,"--n-title-font-weight":ye,"--n-header-border-bottom":ke,"--n-footer-border-top":b,"--n-close-icon-color":I,"--n-close-icon-color-hover":r,"--n-close-icon-color-pressed":y,"--n-close-size":_e,"--n-close-color-hover":N,"--n-close-color-pressed":ze,"--n-close-icon-size":Se,"--n-close-border-radius":l,"--n-resize-trigger-color-hover":zo}}),z=i?ue("drawer",void 0,A,e):void 0;return{mergedClsPrefix:o,namespace:t,mergedBodyStyle:P,handleOutsideClick:M,handleMaskClick:_,handleEsc:Y,mergedTheme:a,cssVars:i?void 0:A,themeClass:z?.themeClass,onRender:z?.onRender,isMounted:n}},render(){const{mergedClsPrefix:e}=this;return s(Lo,{to:this.to,show:this.show},{default:()=>{var o;return(o=this.onRender)===null||o===void 0||o.call(this),Me(s("div",{class:[`${e}-drawer-container`,this.namespace,this.themeClass],style:this.cssVars,role:"none"},this.showMask?s(eo,{name:"fade-in-transition",appear:this.isMounted},{default:()=>this.show?s("div",{"aria-hidden":!0,class:[`${e}-drawer-mask`,this.showMask==="transparent"&&`${e}-drawer-mask--invisible`],onClick:this.handleMaskClick}):null}):null,s(mt,Object.assign({},this.$attrs,{class:[this.drawerClass,this.$attrs.class],style:[this.mergedBodyStyle,this.$attrs.style],blockScroll:this.blockScroll,contentStyle:this.contentStyle,contentClass:this.contentClass,placement:this.placement,scrollbarProps:this.scrollbarProps,show:this.show,displayDirective:this.displayDirective,nativeScrollbar:this.nativeScrollbar,onAfterEnter:this.onAfterEnter,onAfterLeave:this.onAfterLeave,trapFocus:this.trapFocus,autoFocus:this.autoFocus,resizable:this.resizable,maxHeight:this.maxHeight,minHeight:this.minHeight,maxWidth:this.maxWidth,minWidth:this.minWidth,showMask:this.showMask,onEsc:this.handleEsc,onClickoutside:this.handleOutsideClick}),this.$slots)),[[Ko,{zIndex:this.zIndex,enabled:this.show}]])}})}});function Mt(e){const{baseColor:o,textColor2:t,bodyColor:i,cardColor:n,dividerColor:a,actionColor:c,scrollbarColor:f,scrollbarColorHover:u,invertedColor:x}=e;return{textColor:t,textColorInverted:"#FFF",color:i,colorEmbedded:c,headerColor:n,headerColorInverted:x,footerColor:c,footerColorInverted:x,headerBorderColor:a,headerBorderColorInverted:x,footerBorderColor:a,footerBorderColorInverted:x,siderBorderColor:a,siderBorderColorInverted:x,siderColor:n,siderColorInverted:x,siderToggleButtonBorder:`1px solid ${a}`,siderToggleButtonColor:o,siderToggleButtonIconColor:t,siderToggleButtonIconColorInverted:t,siderToggleBarColor:We(i,f),siderToggleBarColorHover:We(i,u),__invertScrollbar:"true"}}const Ae=Vo({name:"Layout",common:Yo,peers:{Scrollbar:Wo},self:Mt}),ho=he("n-layout-sider"),He={type:String,default:"static"},$t=h("layout",`
 color: var(--n-text-color);
 background-color: var(--n-color);
 box-sizing: border-box;
 position: relative;
 z-index: auto;
 flex: auto;
 overflow: hidden;
 transition:
 box-shadow .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
`,[h("layout-scroll-container",`
 overflow-x: hidden;
 box-sizing: border-box;
 height: 100%;
 `),S("absolute-positioned",`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),Ot={embedded:Boolean,position:He,nativeScrollbar:{type:Boolean,default:!0},scrollbarProps:Object,onScroll:Function,contentClass:String,contentStyle:{type:[String,Object],default:""},hasSider:Boolean,siderPlacement:{type:String,default:"left"}},mo=he("n-layout");function vo(e){return $({name:e?"LayoutContent":"Layout",props:Object.assign(Object.assign({},J.props),Ot),setup(o){const t=j(null),i=j(null),{mergedClsPrefixRef:n,inlineThemeDisabled:a}=ae(o),c=J("Layout","-layout",$t,Ae,o,n);function f(_,M){if(o.nativeScrollbar){const{value:B}=t;B&&(M===void 0?B.scrollTo(_):B.scrollTo(_,M))}else{const{value:B}=i;B&&B.scrollTo(_,M)}}q(mo,o);let u=0,x=0;const E=_=>{var M;const B=_.target;u=B.scrollLeft,x=B.scrollTop,(M=o.onScroll)===null||M===void 0||M.call(o,_)};io(()=>{if(o.nativeScrollbar){const _=t.value;_&&(_.scrollTop=x,_.scrollLeft=u)}});const C={display:"flex",flexWrap:"nowrap",width:"100%",flexDirection:"row"},g={scrollTo:f},O=w(()=>{const{common:{cubicBezierEaseInOut:_},self:M}=c.value;return{"--n-bezier":_,"--n-color":o.embedded?M.colorEmbedded:M.color,"--n-text-color":M.textColor}}),P=a?ue("layout",w(()=>o.embedded?"e":""),O,o):void 0;return Object.assign({mergedClsPrefix:n,scrollableElRef:t,scrollbarInstRef:i,hasSiderStyle:C,mergedTheme:c,handleNativeElScroll:E,cssVars:a?void 0:O,themeClass:P?.themeClass,onRender:P?.onRender},g)},render(){var o;const{mergedClsPrefix:t,hasSider:i}=this;(o=this.onRender)===null||o===void 0||o.call(this);const n=i?this.hasSiderStyle:void 0,a=[this.themeClass,e&&`${t}-layout-content`,`${t}-layout`,`${t}-layout--${this.position}-positioned`];return s("div",{class:a,style:this.cssVars},this.nativeScrollbar?s("div",{ref:"scrollableElRef",class:[`${t}-layout-scroll-container`,this.contentClass],style:[this.contentStyle,n],onScroll:this.handleNativeElScroll},this.$slots):s(Be,Object.assign({},this.scrollbarProps,{onScroll:this.onScroll,ref:"scrollbarInstRef",theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,contentClass:this.contentClass,contentStyle:[this.contentStyle,n]}),this.$slots))}})}const Tt=vo(!1),Et=vo(!0),Pt=h("layout-header",`
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 box-sizing: border-box;
 width: 100%;
 background-color: var(--n-color);
 color: var(--n-text-color);
`,[S("absolute-positioned",`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 `),S("bordered",`
 border-bottom: solid 1px var(--n-border-color);
 `)]),Bt={position:He,inverted:Boolean,bordered:{type:Boolean,default:!1}},Nt=$({name:"LayoutHeader",props:Object.assign(Object.assign({},J.props),Bt),setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:t}=ae(e),i=J("Layout","-layout-header",Pt,Ae,e,o),n=w(()=>{const{common:{cubicBezierEaseInOut:c},self:f}=i.value,u={"--n-bezier":c};return e.inverted?(u["--n-color"]=f.headerColorInverted,u["--n-text-color"]=f.textColorInverted,u["--n-border-color"]=f.headerBorderColorInverted):(u["--n-color"]=f.headerColor,u["--n-text-color"]=f.textColor,u["--n-border-color"]=f.headerBorderColor),u}),a=t?ue("layout-header",w(()=>e.inverted?"a":"b"),n,e):void 0;return{mergedClsPrefix:o,cssVars:t?void 0:n,themeClass:a?.themeClass,onRender:a?.onRender}},render(){var e;const{mergedClsPrefix:o}=this;return(e=this.onRender)===null||e===void 0||e.call(this),s("div",{class:[`${o}-layout-header`,this.themeClass,this.position&&`${o}-layout-header--${this.position}-positioned`,this.bordered&&`${o}-layout-header--bordered`],style:this.cssVars},this.$slots)}}),At=h("layout-sider",`
 flex-shrink: 0;
 box-sizing: border-box;
 position: relative;
 z-index: 1;
 color: var(--n-text-color);
 transition:
 color .3s var(--n-bezier),
 border-color .3s var(--n-bezier),
 min-width .3s var(--n-bezier),
 max-width .3s var(--n-bezier),
 transform .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 background-color: var(--n-color);
 display: flex;
 justify-content: flex-end;
`,[S("bordered",[v("border",`
 content: "";
 position: absolute;
 top: 0;
 bottom: 0;
 width: 1px;
 background-color: var(--n-border-color);
 transition: background-color .3s var(--n-bezier);
 `)]),v("left-placement",[S("bordered",[v("border",`
 right: 0;
 `)])]),S("right-placement",`
 justify-content: flex-start;
 `,[S("bordered",[v("border",`
 left: 0;
 `)]),S("collapsed",[h("layout-toggle-button",[h("base-icon",`
 transform: rotate(180deg);
 `)]),h("layout-toggle-bar",[m("&:hover",[v("top",{transform:"rotate(-12deg) scale(1.15) translateY(-2px)"}),v("bottom",{transform:"rotate(12deg) scale(1.15) translateY(2px)"})])])]),h("layout-toggle-button",`
 left: 0;
 transform: translateX(-50%) translateY(-50%);
 `,[h("base-icon",`
 transform: rotate(0);
 `)]),h("layout-toggle-bar",`
 left: -28px;
 transform: rotate(180deg);
 `,[m("&:hover",[v("top",{transform:"rotate(12deg) scale(1.15) translateY(-2px)"}),v("bottom",{transform:"rotate(-12deg) scale(1.15) translateY(2px)"})])])]),S("collapsed",[h("layout-toggle-bar",[m("&:hover",[v("top",{transform:"rotate(-12deg) scale(1.15) translateY(-2px)"}),v("bottom",{transform:"rotate(12deg) scale(1.15) translateY(2px)"})])]),h("layout-toggle-button",[h("base-icon",`
 transform: rotate(0);
 `)])]),h("layout-toggle-button",`
 transition:
 color .3s var(--n-bezier),
 right .3s var(--n-bezier),
 left .3s var(--n-bezier),
 border-color .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 cursor: pointer;
 width: 24px;
 height: 24px;
 position: absolute;
 top: 50%;
 right: 0;
 border-radius: 50%;
 display: flex;
 align-items: center;
 justify-content: center;
 font-size: 18px;
 color: var(--n-toggle-button-icon-color);
 border: var(--n-toggle-button-border);
 background-color: var(--n-toggle-button-color);
 box-shadow: 0 2px 4px 0px rgba(0, 0, 0, .06);
 transform: translateX(50%) translateY(-50%);
 z-index: 1;
 `,[h("base-icon",`
 transition: transform .3s var(--n-bezier);
 transform: rotate(180deg);
 `)]),h("layout-toggle-bar",`
 cursor: pointer;
 height: 72px;
 width: 32px;
 position: absolute;
 top: calc(50% - 36px);
 right: -28px;
 `,[v("top, bottom",`
 position: absolute;
 width: 4px;
 border-radius: 2px;
 height: 38px;
 left: 14px;
 transition: 
 background-color .3s var(--n-bezier),
 transform .3s var(--n-bezier);
 `),v("bottom",`
 position: absolute;
 top: 34px;
 `),m("&:hover",[v("top",{transform:"rotate(12deg) scale(1.15) translateY(-2px)"}),v("bottom",{transform:"rotate(-12deg) scale(1.15) translateY(2px)"})]),v("top, bottom",{backgroundColor:"var(--n-toggle-bar-color)"}),m("&:hover",[v("top, bottom",{backgroundColor:"var(--n-toggle-bar-color-hover)"})])]),v("border",`
 position: absolute;
 top: 0;
 right: 0;
 bottom: 0;
 width: 1px;
 transition: background-color .3s var(--n-bezier);
 `),h("layout-sider-scroll-container",`
 flex-grow: 1;
 flex-shrink: 0;
 box-sizing: border-box;
 height: 100%;
 opacity: 0;
 transition: opacity .3s var(--n-bezier);
 max-width: 100%;
 `),S("show-content",[h("layout-sider-scroll-container",{opacity:1})]),S("absolute-positioned",`
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 `)]),Ht=$({props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){const{clsPrefix:e}=this;return s("div",{onClick:this.onClick,class:`${e}-layout-toggle-bar`},s("div",{class:`${e}-layout-toggle-bar__top`}),s("div",{class:`${e}-layout-toggle-bar__bottom`}))}}),Ft=$({name:"LayoutToggleButton",props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){const{clsPrefix:e}=this;return s("div",{class:`${e}-layout-toggle-button`,onClick:this.onClick},s(lo,{clsPrefix:e},{default:()=>s(lt,null)}))}}),Lt={position:He,bordered:Boolean,collapsedWidth:{type:Number,default:48},width:{type:[Number,String],default:272},contentClass:String,contentStyle:{type:[String,Object],default:""},collapseMode:{type:String,default:"transform"},collapsed:{type:Boolean,default:void 0},defaultCollapsed:Boolean,showCollapsedContent:{type:Boolean,default:!0},showTrigger:{type:[Boolean,String],default:!1},nativeScrollbar:{type:Boolean,default:!0},inverted:Boolean,scrollbarProps:Object,triggerClass:String,triggerStyle:[String,Object],collapsedTriggerClass:String,collapsedTriggerStyle:[String,Object],"onUpdate:collapsed":[Function,Array],onUpdateCollapsed:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,onExpand:[Function,Array],onCollapse:[Function,Array],onScroll:Function},jt=$({name:"LayoutSider",props:Object.assign(Object.assign({},J.props),Lt),setup(e){const o=Z(mo),t=j(null),i=j(null),n=j(e.defaultCollapsed),a=de(le(e,"collapsed"),n),c=w(()=>ce(a.value?e.collapsedWidth:e.width)),f=w(()=>e.collapseMode!=="transform"?{}:{minWidth:ce(e.width)}),u=w(()=>o?o.siderPlacement:"left");function x(z,d){if(e.nativeScrollbar){const{value:p}=t;p&&(d===void 0?p.scrollTo(z):p.scrollTo(z,d))}else{const{value:p}=i;p&&p.scrollTo(z,d)}}function E(){const{"onUpdate:collapsed":z,onUpdateCollapsed:d,onExpand:p,onCollapse:H}=e,{value:k}=a;d&&D(d,!k),z&&D(z,!k),n.value=!k,k?p&&D(p):H&&D(H)}let C=0,g=0;const O=z=>{var d;const p=z.target;C=p.scrollLeft,g=p.scrollTop,(d=e.onScroll)===null||d===void 0||d.call(e,z)};io(()=>{if(e.nativeScrollbar){const z=t.value;z&&(z.scrollTop=g,z.scrollLeft=C)}}),q(ho,{collapsedRef:a,collapseModeRef:le(e,"collapseMode")});const{mergedClsPrefixRef:P,inlineThemeDisabled:_}=ae(e),M=J("Layout","-layout-sider",At,Ae,e,P);function B(z){var d,p;z.propertyName==="max-width"&&(a.value?(d=e.onAfterLeave)===null||d===void 0||d.call(e):(p=e.onAfterEnter)===null||p===void 0||p.call(e))}const Y={scrollTo:x},U=w(()=>{const{common:{cubicBezierEaseInOut:z},self:d}=M.value,{siderToggleButtonColor:p,siderToggleButtonBorder:H,siderToggleBarColor:k,siderToggleBarColorHover:L}=d,T={"--n-bezier":z,"--n-toggle-button-color":p,"--n-toggle-button-border":H,"--n-toggle-bar-color":k,"--n-toggle-bar-color-hover":L};return e.inverted?(T["--n-color"]=d.siderColorInverted,T["--n-text-color"]=d.textColorInverted,T["--n-border-color"]=d.siderBorderColorInverted,T["--n-toggle-button-icon-color"]=d.siderToggleButtonIconColorInverted,T.__invertScrollbar=d.__invertScrollbar):(T["--n-color"]=d.siderColor,T["--n-text-color"]=d.textColor,T["--n-border-color"]=d.siderBorderColor,T["--n-toggle-button-icon-color"]=d.siderToggleButtonIconColor),T}),A=_?ue("layout-sider",w(()=>e.inverted?"a":"b"),U,e):void 0;return Object.assign({scrollableElRef:t,scrollbarInstRef:i,mergedClsPrefix:P,mergedTheme:M,styleMaxWidth:c,mergedCollapsed:a,scrollContainerStyle:f,siderPlacement:u,handleNativeElScroll:O,handleTransitionend:B,handleTriggerClick:E,inlineThemeDisabled:_,cssVars:U,themeClass:A?.themeClass,onRender:A?.onRender},Y)},render(){var e;const{mergedClsPrefix:o,mergedCollapsed:t,showTrigger:i}=this;return(e=this.onRender)===null||e===void 0||e.call(this),s("aside",{class:[`${o}-layout-sider`,this.themeClass,`${o}-layout-sider--${this.position}-positioned`,`${o}-layout-sider--${this.siderPlacement}-placement`,this.bordered&&`${o}-layout-sider--bordered`,t&&`${o}-layout-sider--collapsed`,(!t||this.showCollapsedContent)&&`${o}-layout-sider--show-content`],onTransitionend:this.handleTransitionend,style:[this.inlineThemeDisabled?void 0:this.cssVars,{maxWidth:this.styleMaxWidth,width:ce(this.width)}]},this.nativeScrollbar?s("div",{class:[`${o}-layout-sider-scroll-container`,this.contentClass],onScroll:this.handleNativeElScroll,style:[this.scrollContainerStyle,{overflow:"auto"},this.contentStyle],ref:"scrollableElRef"},this.$slots):s(Be,Object.assign({},this.scrollbarProps,{onScroll:this.onScroll,ref:"scrollbarInstRef",style:this.scrollContainerStyle,contentStyle:this.contentStyle,contentClass:this.contentClass,theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,builtinThemeOverrides:this.inverted&&this.cssVars.__invertScrollbar==="true"?{colorHover:"rgba(255, 255, 255, .4)",color:"rgba(255, 255, 255, .3)"}:void 0}),this.$slots),i?i==="bar"?s(Ht,{clsPrefix:o,class:t?this.collapsedTriggerClass:this.triggerClass,style:t?this.collapsedTriggerStyle:this.triggerStyle,onClick:this.handleTriggerClick}):s(Ft,{clsPrefix:o,class:t?this.collapsedTriggerClass:this.triggerClass,style:t?this.collapsedTriggerStyle:this.triggerStyle,onClick:this.handleTriggerClick}):null,this.bordered?s("div",{class:`${o}-layout-sider__border`}):null)}}),me=he("n-menu"),fo=he("n-submenu"),Fe=he("n-menu-item-group"),Xe=[m("&::before","background-color: var(--n-item-color-hover);"),v("arrow",`
 color: var(--n-arrow-color-hover);
 `),v("icon",`
 color: var(--n-item-icon-color-hover);
 `),h("menu-item-content-header",`
 color: var(--n-item-text-color-hover);
 `,[m("a",`
 color: var(--n-item-text-color-hover);
 `),v("extra",`
 color: var(--n-item-text-color-hover);
 `)])],qe=[v("icon",`
 color: var(--n-item-icon-color-hover-horizontal);
 `),h("menu-item-content-header",`
 color: var(--n-item-text-color-hover-horizontal);
 `,[m("a",`
 color: var(--n-item-text-color-hover-horizontal);
 `),v("extra",`
 color: var(--n-item-text-color-hover-horizontal);
 `)])],Dt=m([h("menu",`
 background-color: var(--n-color);
 color: var(--n-item-text-color);
 overflow: hidden;
 transition: background-color .3s var(--n-bezier);
 box-sizing: border-box;
 font-size: var(--n-font-size);
 padding-bottom: 6px;
 `,[S("horizontal",`
 max-width: 100%;
 width: 100%;
 display: flex;
 overflow: hidden;
 padding-bottom: 0;
 `,[h("submenu","margin: 0;"),h("menu-item","margin: 0;"),h("menu-item-content",`
 padding: 0 20px;
 border-bottom: 2px solid #0000;
 `,[m("&::before","display: none;"),S("selected","border-bottom: 2px solid var(--n-border-color-horizontal)")]),h("menu-item-content",[S("selected",[v("icon","color: var(--n-item-icon-color-active-horizontal);"),h("menu-item-content-header",`
 color: var(--n-item-text-color-active-horizontal);
 `,[m("a","color: var(--n-item-text-color-active-horizontal);"),v("extra","color: var(--n-item-text-color-active-horizontal);")])]),S("child-active",`
 border-bottom: 2px solid var(--n-border-color-horizontal);
 `,[h("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-horizontal);
 `,[m("a",`
 color: var(--n-item-text-color-child-active-horizontal);
 `),v("extra",`
 color: var(--n-item-text-color-child-active-horizontal);
 `)]),v("icon",`
 color: var(--n-item-icon-color-child-active-horizontal);
 `)]),se("disabled",[se("selected, child-active",[m("&:focus-within",qe)]),S("selected",[ee(null,[v("icon","color: var(--n-item-icon-color-active-hover-horizontal);"),h("menu-item-content-header",`
 color: var(--n-item-text-color-active-hover-horizontal);
 `,[m("a","color: var(--n-item-text-color-active-hover-horizontal);"),v("extra","color: var(--n-item-text-color-active-hover-horizontal);")])])]),S("child-active",[ee(null,[v("icon","color: var(--n-item-icon-color-child-active-hover-horizontal);"),h("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-hover-horizontal);
 `,[m("a","color: var(--n-item-text-color-child-active-hover-horizontal);"),v("extra","color: var(--n-item-text-color-child-active-hover-horizontal);")])])]),ee("border-bottom: 2px solid var(--n-border-color-horizontal);",qe)]),h("menu-item-content-header",[m("a","color: var(--n-item-text-color-horizontal);")])])]),se("responsive",[h("menu-item-content-header",`
 overflow: hidden;
 text-overflow: ellipsis;
 `)]),S("collapsed",[h("menu-item-content",[S("selected",[m("&::before",`
 background-color: var(--n-item-color-active-collapsed) !important;
 `)]),h("menu-item-content-header","opacity: 0;"),v("arrow","opacity: 0;"),v("icon","color: var(--n-item-icon-color-collapsed);")])]),h("menu-item",`
 height: var(--n-item-height);
 margin-top: 6px;
 position: relative;
 `),h("menu-item-content",`
 box-sizing: border-box;
 line-height: 1.75;
 height: 100%;
 display: grid;
 grid-template-areas: "icon content arrow";
 grid-template-columns: auto 1fr auto;
 align-items: center;
 cursor: pointer;
 position: relative;
 padding-right: 18px;
 transition:
 background-color .3s var(--n-bezier),
 padding-left .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[m("> *","z-index: 1;"),m("&::before",`
 z-index: auto;
 content: "";
 background-color: #0000;
 position: absolute;
 left: 8px;
 right: 8px;
 top: 0;
 bottom: 0;
 pointer-events: none;
 border-radius: var(--n-border-radius);
 transition: background-color .3s var(--n-bezier);
 `),S("disabled",`
 opacity: .45;
 cursor: not-allowed;
 `),S("collapsed",[v("arrow","transform: rotate(0);")]),S("selected",[m("&::before","background-color: var(--n-item-color-active);"),v("arrow","color: var(--n-arrow-color-active);"),v("icon","color: var(--n-item-icon-color-active);"),h("menu-item-content-header",`
 color: var(--n-item-text-color-active);
 `,[m("a","color: var(--n-item-text-color-active);"),v("extra","color: var(--n-item-text-color-active);")])]),S("child-active",[h("menu-item-content-header",`
 color: var(--n-item-text-color-child-active);
 `,[m("a",`
 color: var(--n-item-text-color-child-active);
 `),v("extra",`
 color: var(--n-item-text-color-child-active);
 `)]),v("arrow",`
 color: var(--n-arrow-color-child-active);
 `),v("icon",`
 color: var(--n-item-icon-color-child-active);
 `)]),se("disabled",[se("selected, child-active",[m("&:focus-within",Xe)]),S("selected",[ee(null,[v("arrow","color: var(--n-arrow-color-active-hover);"),v("icon","color: var(--n-item-icon-color-active-hover);"),h("menu-item-content-header",`
 color: var(--n-item-text-color-active-hover);
 `,[m("a","color: var(--n-item-text-color-active-hover);"),v("extra","color: var(--n-item-text-color-active-hover);")])])]),S("child-active",[ee(null,[v("arrow","color: var(--n-arrow-color-child-active-hover);"),v("icon","color: var(--n-item-icon-color-child-active-hover);"),h("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-hover);
 `,[m("a","color: var(--n-item-text-color-child-active-hover);"),v("extra","color: var(--n-item-text-color-child-active-hover);")])])]),S("selected",[ee(null,[m("&::before","background-color: var(--n-item-color-active-hover);")])]),ee(null,Xe)]),v("icon",`
 grid-area: icon;
 color: var(--n-item-icon-color);
 transition:
 color .3s var(--n-bezier),
 font-size .3s var(--n-bezier),
 margin-right .3s var(--n-bezier);
 box-sizing: content-box;
 display: inline-flex;
 align-items: center;
 justify-content: center;
 `),v("arrow",`
 grid-area: arrow;
 font-size: 16px;
 color: var(--n-arrow-color);
 transform: rotate(180deg);
 opacity: 1;
 transition:
 color .3s var(--n-bezier),
 transform 0.2s var(--n-bezier),
 opacity 0.2s var(--n-bezier);
 `),h("menu-item-content-header",`
 grid-area: content;
 transition:
 color .3s var(--n-bezier),
 opacity .3s var(--n-bezier);
 opacity: 1;
 white-space: nowrap;
 color: var(--n-item-text-color);
 `,[m("a",`
 outline: none;
 text-decoration: none;
 transition: color .3s var(--n-bezier);
 color: var(--n-item-text-color);
 `,[m("&::before",`
 content: "";
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),v("extra",`
 font-size: .93em;
 color: var(--n-group-text-color);
 transition: color .3s var(--n-bezier);
 `)])]),h("submenu",`
 cursor: pointer;
 position: relative;
 margin-top: 6px;
 `,[h("menu-item-content",`
 height: var(--n-item-height);
 `),h("submenu-children",`
 overflow: hidden;
 padding: 0;
 `,[Go({duration:".2s"})])]),h("menu-item-group",[h("menu-item-group-title",`
 margin-top: 6px;
 color: var(--n-group-text-color);
 cursor: default;
 font-size: .93em;
 height: 36px;
 display: flex;
 align-items: center;
 transition:
 padding-left .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `)])]),h("menu-tooltip",[m("a",`
 color: inherit;
 text-decoration: none;
 `)]),h("menu-divider",`
 transition: background-color .3s var(--n-bezier);
 background-color: var(--n-divider-color);
 height: 1px;
 margin: 6px 18px;
 `)]);function ee(e,o){return[S("hover",e,o),m("&:hover",e,o)]}const po=$({name:"MenuOptionContent",props:{collapsed:Boolean,disabled:Boolean,title:[String,Function],icon:Function,extra:[String,Function],showArrow:Boolean,childActive:Boolean,hover:Boolean,paddingLeft:Number,selected:Boolean,maxIconSize:{type:Number,required:!0},activeIconSize:{type:Number,required:!0},iconMarginRight:{type:Number,required:!0},clsPrefix:{type:String,required:!0},onClick:Function,tmNode:{type:Object,required:!0},isEllipsisPlaceholder:Boolean},setup(e){const{props:o}=Z(me);return{menuProps:o,style:w(()=>{const{paddingLeft:t}=e;return{paddingLeft:t&&`${t}px`}}),iconStyle:w(()=>{const{maxIconSize:t,activeIconSize:i,iconMarginRight:n}=e;return{width:`${t}px`,height:`${t}px`,fontSize:`${i}px`,marginRight:`${n}px`}})}},render(){const{clsPrefix:e,tmNode:o,menuProps:{renderIcon:t,renderLabel:i,renderExtra:n,expandIcon:a}}=this,c=t?t(o.rawNode):ie(this.icon);return s("div",{onClick:f=>{var u;(u=this.onClick)===null||u===void 0||u.call(this,f)},role:"none",class:[`${e}-menu-item-content`,{[`${e}-menu-item-content--selected`]:this.selected,[`${e}-menu-item-content--collapsed`]:this.collapsed,[`${e}-menu-item-content--child-active`]:this.childActive,[`${e}-menu-item-content--disabled`]:this.disabled,[`${e}-menu-item-content--hover`]:this.hover}],style:this.style},c&&s("div",{class:`${e}-menu-item-content__icon`,style:this.iconStyle,role:"none"},[c]),s("div",{class:`${e}-menu-item-content-header`,role:"none"},this.isEllipsisPlaceholder?this.title:i?i(o.rawNode):ie(this.title),this.extra||n?s("span",{class:`${e}-menu-item-content-header__extra`}," ",n?n(o.rawNode):ie(this.extra)):null),this.showArrow?s(lo,{ariaHidden:!0,class:`${e}-menu-item-content__arrow`,clsPrefix:e},{default:()=>a?a(o.rawNode):s(ht,null)}):null)}}),ve=8;function Le(e){const o=Z(me),{props:t,mergedCollapsedRef:i}=o,n=Z(fo,null),a=Z(Fe,null),c=w(()=>t.mode==="horizontal"),f=w(()=>c.value?t.dropdownPlacement:"tmNodes"in e?"right-start":"right"),u=w(()=>{var g;return Math.max((g=t.collapsedIconSize)!==null&&g!==void 0?g:t.iconSize,t.iconSize)}),x=w(()=>{var g;return!c.value&&e.root&&i.value&&(g=t.collapsedIconSize)!==null&&g!==void 0?g:t.iconSize}),E=w(()=>{if(c.value)return;const{collapsedWidth:g,indent:O,rootIndent:P}=t,{root:_,isGroup:M}=e,B=P===void 0?O:P;return _?i.value?g/2-u.value/2:B:a&&typeof a.paddingLeftRef.value=="number"?O/2+a.paddingLeftRef.value:n&&typeof n.paddingLeftRef.value=="number"?(M?O/2:O)+n.paddingLeftRef.value:0}),C=w(()=>{const{collapsedWidth:g,indent:O,rootIndent:P}=t,{value:_}=u,{root:M}=e;return c.value||!M||!i.value?ve:(P===void 0?O:P)+_+ve-(g+_)/2});return{dropdownPlacement:f,activeIconSize:x,maxIconSize:u,paddingLeft:E,iconMarginRight:C,NMenu:o,NSubmenu:n,NMenuOptionGroup:a}}const je={internalKey:{type:[String,Number],required:!0},root:Boolean,isGroup:Boolean,level:{type:Number,required:!0},title:[String,Function],extra:[String,Function]},Kt=$({name:"MenuDivider",setup(){const e=Z(me),{mergedClsPrefixRef:o,isHorizontalRef:t}=e;return()=>t.value?null:s("div",{class:`${o.value}-menu-divider`})}}),go=Object.assign(Object.assign({},je),{tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function}),Ut=Ne(go),Vt=$({name:"MenuOption",props:go,setup(e){const o=Le(e),{NSubmenu:t,NMenu:i,NMenuOptionGroup:n}=o,{props:a,mergedClsPrefixRef:c,mergedCollapsedRef:f}=i,u=t?t.mergedDisabledRef:n?n.mergedDisabledRef:{value:!1},x=w(()=>u.value||e.disabled);function E(g){const{onClick:O}=e;O&&O(g)}function C(g){x.value||(i.doSelect(e.internalKey,e.tmNode.rawNode),E(g))}return{mergedClsPrefix:c,dropdownPlacement:o.dropdownPlacement,paddingLeft:o.paddingLeft,iconMarginRight:o.iconMarginRight,maxIconSize:o.maxIconSize,activeIconSize:o.activeIconSize,mergedTheme:i.mergedThemeRef,menuProps:a,dropdownEnabled:Te(()=>e.root&&f.value&&a.mode!=="horizontal"&&!x.value),selected:Te(()=>i.mergedValueRef.value===e.internalKey),mergedDisabled:x,handleClick:C}},render(){const{mergedClsPrefix:e,mergedTheme:o,tmNode:t,menuProps:{renderLabel:i,nodeProps:n}}=this,a=n?.(t.rawNode);return s("div",Object.assign({},a,{role:"menuitem",class:[`${e}-menu-item`,a?.class]}),s(ct,{theme:o.peers.Tooltip,themeOverrides:o.peerOverrides.Tooltip,trigger:"hover",placement:this.dropdownPlacement,disabled:!this.dropdownEnabled||this.title===void 0,internalExtraClass:["menu-tooltip"]},{default:()=>i?i(t.rawNode):ie(this.title),trigger:()=>s(po,{tmNode:t,clsPrefix:e,paddingLeft:this.paddingLeft,iconMarginRight:this.iconMarginRight,maxIconSize:this.maxIconSize,activeIconSize:this.activeIconSize,selected:this.selected,title:this.title,extra:this.extra,disabled:this.mergedDisabled,icon:this.icon,onClick:this.handleClick})}))}}),bo=Object.assign(Object.assign({},je),{tmNode:{type:Object,required:!0},tmNodes:{type:Array,required:!0}}),Wt=Ne(bo),Yt=$({name:"MenuOptionGroup",props:bo,setup(e){const o=Le(e),{NSubmenu:t}=o,i=w(()=>t?.mergedDisabledRef.value?!0:e.tmNode.disabled);q(Fe,{paddingLeftRef:o.paddingLeft,mergedDisabledRef:i});const{mergedClsPrefixRef:n,props:a}=Z(me);return function(){const{value:c}=n,f=o.paddingLeft.value,{nodeProps:u}=a,x=u?.(e.tmNode.rawNode);return s("div",{class:`${c}-menu-item-group`,role:"group"},s("div",Object.assign({},x,{class:[`${c}-menu-item-group-title`,x?.class],style:[x?.style||"",f!==void 0?`padding-left: ${f}px;`:""]}),ie(e.title),e.extra?s(to,null," ",ie(e.extra)):null),s("div",null,e.tmNodes.map(E=>De(E,a))))}}});function Ee(e){return e.type==="divider"||e.type==="render"}function Gt(e){return e.type==="divider"}function De(e,o){const{rawNode:t}=e,{show:i}=t;if(i===!1)return null;if(Ee(t))return Gt(t)?s(Kt,Object.assign({key:e.key},t.props)):null;const{labelField:n}=o,{key:a,level:c,isGroup:f}=e,u=Object.assign(Object.assign({},t),{title:t.title||t[n],extra:t.titleExtra||t.extra,key:a,internalKey:a,level:c,root:c===0,isGroup:f});return e.children?e.isGroup?s(Yt,Ie(u,Wt,{tmNode:e,tmNodes:e.children,key:a})):s(Pe,Ie(u,Xt,{key:a,rawNodes:t[o.childrenField],tmNodes:e.children,tmNode:e})):s(Vt,Ie(u,Ut,{key:a,tmNode:e}))}const xo=Object.assign(Object.assign({},je),{rawNodes:{type:Array,default:()=>[]},tmNodes:{type:Array,default:()=>[]},tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function,domId:String,virtualChildActive:{type:Boolean,default:void 0},isEllipsisPlaceholder:Boolean}),Xt=Ne(xo),Pe=$({name:"Submenu",props:xo,setup(e){const o=Le(e),{NMenu:t,NSubmenu:i}=o,{props:n,mergedCollapsedRef:a,mergedThemeRef:c}=t,f=w(()=>{const{disabled:g}=e;return i?.mergedDisabledRef.value||n.disabled?!0:g}),u=j(!1);q(fo,{paddingLeftRef:o.paddingLeft,mergedDisabledRef:f}),q(Fe,null);function x(){const{onClick:g}=e;g&&g()}function E(){f.value||(a.value||t.toggleExpand(e.internalKey),x())}function C(g){u.value=g}return{menuProps:n,mergedTheme:c,doSelect:t.doSelect,inverted:t.invertedRef,isHorizontal:t.isHorizontalRef,mergedClsPrefix:t.mergedClsPrefixRef,maxIconSize:o.maxIconSize,activeIconSize:o.activeIconSize,iconMarginRight:o.iconMarginRight,dropdownPlacement:o.dropdownPlacement,dropdownShow:u,paddingLeft:o.paddingLeft,mergedDisabled:f,mergedValue:t.mergedValueRef,childActive:Te(()=>{var g;return(g=e.virtualChildActive)!==null&&g!==void 0?g:t.activePathRef.value.includes(e.internalKey)}),collapsed:w(()=>n.mode==="horizontal"?!1:a.value?!0:!t.mergedExpandedKeysRef.value.includes(e.internalKey)),dropdownEnabled:w(()=>!f.value&&(n.mode==="horizontal"||a.value)),handlePopoverShowChange:C,handleClick:E}},render(){var e;const{mergedClsPrefix:o,menuProps:{renderIcon:t,renderLabel:i}}=this,n=()=>{const{isHorizontal:c,paddingLeft:f,collapsed:u,mergedDisabled:x,maxIconSize:E,activeIconSize:C,title:g,childActive:O,icon:P,handleClick:_,menuProps:{nodeProps:M},dropdownShow:B,iconMarginRight:Y,tmNode:U,mergedClsPrefix:A,isEllipsisPlaceholder:z,extra:d}=this,p=M?.(U.rawNode);return s("div",Object.assign({},p,{class:[`${A}-menu-item`,p?.class],role:"menuitem"}),s(po,{tmNode:U,paddingLeft:f,collapsed:u,disabled:x,iconMarginRight:Y,maxIconSize:E,activeIconSize:C,title:g,extra:d,showArrow:!c,childActive:O,clsPrefix:A,icon:P,hover:B,onClick:_,isEllipsisPlaceholder:z}))},a=()=>s(Xo,null,{default:()=>{const{tmNodes:c,collapsed:f}=this;return f?null:s("div",{class:`${o}-submenu-children`,role:"menu"},c.map(u=>De(u,this.menuProps)))}});return this.root?s(co,Object.assign({size:"large",trigger:"hover"},(e=this.menuProps)===null||e===void 0?void 0:e.dropdownProps,{themeOverrides:this.mergedTheme.peerOverrides.Dropdown,theme:this.mergedTheme.peers.Dropdown,builtinThemeOverrides:{fontSizeLarge:"14px",optionIconSizeLarge:"18px"},value:this.mergedValue,disabled:!this.dropdownEnabled,placement:this.dropdownPlacement,keyField:this.menuProps.keyField,labelField:this.menuProps.labelField,childrenField:this.menuProps.childrenField,onUpdateShow:this.handlePopoverShowChange,options:this.rawNodes,onSelect:this.doSelect,inverted:this.inverted,renderIcon:t,renderLabel:i}),{default:()=>s("div",{class:`${o}-submenu`,role:"menu","aria-expanded":!this.collapsed,id:this.domId},n(),this.isHorizontal?null:a())}):s("div",{class:`${o}-submenu`,role:"menu","aria-expanded":!this.collapsed,id:this.domId},n(),a())}}),qt=Object.assign(Object.assign({},J.props),{options:{type:Array,default:()=>[]},collapsed:{type:Boolean,default:void 0},collapsedWidth:{type:Number,default:48},iconSize:{type:Number,default:20},collapsedIconSize:{type:Number,default:24},rootIndent:Number,indent:{type:Number,default:32},labelField:{type:String,default:"label"},keyField:{type:String,default:"key"},childrenField:{type:String,default:"children"},disabledField:{type:String,default:"disabled"},defaultExpandAll:Boolean,defaultExpandedKeys:Array,expandedKeys:Array,value:[String,Number],defaultValue:{type:[String,Number],default:null},mode:{type:String,default:"vertical"},watchProps:{type:Array,default:void 0},disabled:Boolean,show:{type:Boolean,default:!0},inverted:Boolean,"onUpdate:expandedKeys":[Function,Array],onUpdateExpandedKeys:[Function,Array],onUpdateValue:[Function,Array],"onUpdate:value":[Function,Array],expandIcon:Function,renderIcon:Function,renderLabel:Function,renderExtra:Function,dropdownProps:Object,accordion:Boolean,nodeProps:Function,dropdownPlacement:{type:String,default:"bottom"},responsive:Boolean,items:Array,onOpenNamesChange:[Function,Array],onSelect:[Function,Array],onExpandedNamesChange:[Function,Array],expandedNames:Array,defaultExpandedNames:Array}),Jt=$({name:"Menu",inheritAttrs:!1,props:qt,setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:t}=ae(e),i=J("Menu","-menu",Dt,st,e,o),n=Z(ho,null),a=w(()=>{var b;const{collapsed:I}=e;if(I!==void 0)return I;if(n){const{collapseModeRef:r,collapsedRef:y}=n;if(r.value==="width")return(b=y.value)!==null&&b!==void 0?b:!1}return!1}),c=w(()=>{const{keyField:b,childrenField:I,disabledField:r}=e;return Re(e.items||e.options,{getIgnored(y){return Ee(y)},getChildren(y){return y[I]},getDisabled(y){return y[r]},getKey(y){var N;return(N=y[b])!==null&&N!==void 0?N:y.name}})}),f=w(()=>new Set(c.value.treeNodes.map(b=>b.key))),{watchProps:u}=e,x=j(null);u?.includes("defaultValue")?$e(()=>{x.value=e.defaultValue}):x.value=e.defaultValue;const E=le(e,"value"),C=de(E,x),g=j([]),O=()=>{g.value=e.defaultExpandAll?c.value.getNonLeafKeys():e.defaultExpandedNames||e.defaultExpandedKeys||c.value.getPath(C.value,{includeSelf:!1}).keyPath};u?.includes("defaultExpandedKeys")?$e(O):O();const P=ut(e,["expandedNames","expandedKeys"]),_=de(P,g),M=w(()=>c.value.treeNodes),B=w(()=>c.value.getPath(C.value).keyPath);q(me,{props:e,mergedCollapsedRef:a,mergedThemeRef:i,mergedValueRef:C,mergedExpandedKeysRef:_,activePathRef:B,mergedClsPrefixRef:o,isHorizontalRef:w(()=>e.mode==="horizontal"),invertedRef:le(e,"inverted"),doSelect:Y,toggleExpand:A});function Y(b,I){const{"onUpdate:value":r,onUpdateValue:y,onSelect:N}=e;y&&D(y,b,I),r&&D(r,b,I),N&&D(N,b,I),x.value=b}function U(b){const{"onUpdate:expandedKeys":I,onUpdateExpandedKeys:r,onExpandedNamesChange:y,onOpenNamesChange:N}=e;I&&D(I,b),r&&D(r,b),y&&D(y,b),N&&D(N,b),g.value=b}function A(b){const I=Array.from(_.value),r=I.findIndex(y=>y===b);if(~r)I.splice(r,1);else{if(e.accordion&&f.value.has(b)){const y=I.findIndex(N=>f.value.has(N));y>-1&&I.splice(y,1)}I.push(b)}U(I)}const z=b=>{const I=c.value.getPath(b??C.value,{includeSelf:!1}).keyPath;if(!I.length)return;const r=Array.from(_.value),y=new Set([...r,...I]);e.accordion&&f.value.forEach(N=>{y.has(N)&&!I.includes(N)&&y.delete(N)}),U(Array.from(y))},d=w(()=>{const{inverted:b}=e,{common:{cubicBezierEaseInOut:I},self:r}=i.value,{borderRadius:y,borderColorHorizontal:N,fontSize:ze,itemHeight:Se,dividerColor:_e}=r,l={"--n-divider-color":_e,"--n-bezier":I,"--n-font-size":ze,"--n-border-color-horizontal":N,"--n-border-radius":y,"--n-item-height":Se};return b?(l["--n-group-text-color"]=r.groupTextColorInverted,l["--n-color"]=r.colorInverted,l["--n-item-text-color"]=r.itemTextColorInverted,l["--n-item-text-color-hover"]=r.itemTextColorHoverInverted,l["--n-item-text-color-active"]=r.itemTextColorActiveInverted,l["--n-item-text-color-child-active"]=r.itemTextColorChildActiveInverted,l["--n-item-text-color-child-active-hover"]=r.itemTextColorChildActiveInverted,l["--n-item-text-color-active-hover"]=r.itemTextColorActiveHoverInverted,l["--n-item-icon-color"]=r.itemIconColorInverted,l["--n-item-icon-color-hover"]=r.itemIconColorHoverInverted,l["--n-item-icon-color-active"]=r.itemIconColorActiveInverted,l["--n-item-icon-color-active-hover"]=r.itemIconColorActiveHoverInverted,l["--n-item-icon-color-child-active"]=r.itemIconColorChildActiveInverted,l["--n-item-icon-color-child-active-hover"]=r.itemIconColorChildActiveHoverInverted,l["--n-item-icon-color-collapsed"]=r.itemIconColorCollapsedInverted,l["--n-item-text-color-horizontal"]=r.itemTextColorHorizontalInverted,l["--n-item-text-color-hover-horizontal"]=r.itemTextColorHoverHorizontalInverted,l["--n-item-text-color-active-horizontal"]=r.itemTextColorActiveHorizontalInverted,l["--n-item-text-color-child-active-horizontal"]=r.itemTextColorChildActiveHorizontalInverted,l["--n-item-text-color-child-active-hover-horizontal"]=r.itemTextColorChildActiveHoverHorizontalInverted,l["--n-item-text-color-active-hover-horizontal"]=r.itemTextColorActiveHoverHorizontalInverted,l["--n-item-icon-color-horizontal"]=r.itemIconColorHorizontalInverted,l["--n-item-icon-color-hover-horizontal"]=r.itemIconColorHoverHorizontalInverted,l["--n-item-icon-color-active-horizontal"]=r.itemIconColorActiveHorizontalInverted,l["--n-item-icon-color-active-hover-horizontal"]=r.itemIconColorActiveHoverHorizontalInverted,l["--n-item-icon-color-child-active-horizontal"]=r.itemIconColorChildActiveHorizontalInverted,l["--n-item-icon-color-child-active-hover-horizontal"]=r.itemIconColorChildActiveHoverHorizontalInverted,l["--n-arrow-color"]=r.arrowColorInverted,l["--n-arrow-color-hover"]=r.arrowColorHoverInverted,l["--n-arrow-color-active"]=r.arrowColorActiveInverted,l["--n-arrow-color-active-hover"]=r.arrowColorActiveHoverInverted,l["--n-arrow-color-child-active"]=r.arrowColorChildActiveInverted,l["--n-arrow-color-child-active-hover"]=r.arrowColorChildActiveHoverInverted,l["--n-item-color-hover"]=r.itemColorHoverInverted,l["--n-item-color-active"]=r.itemColorActiveInverted,l["--n-item-color-active-hover"]=r.itemColorActiveHoverInverted,l["--n-item-color-active-collapsed"]=r.itemColorActiveCollapsedInverted):(l["--n-group-text-color"]=r.groupTextColor,l["--n-color"]=r.color,l["--n-item-text-color"]=r.itemTextColor,l["--n-item-text-color-hover"]=r.itemTextColorHover,l["--n-item-text-color-active"]=r.itemTextColorActive,l["--n-item-text-color-child-active"]=r.itemTextColorChildActive,l["--n-item-text-color-child-active-hover"]=r.itemTextColorChildActiveHover,l["--n-item-text-color-active-hover"]=r.itemTextColorActiveHover,l["--n-item-icon-color"]=r.itemIconColor,l["--n-item-icon-color-hover"]=r.itemIconColorHover,l["--n-item-icon-color-active"]=r.itemIconColorActive,l["--n-item-icon-color-active-hover"]=r.itemIconColorActiveHover,l["--n-item-icon-color-child-active"]=r.itemIconColorChildActive,l["--n-item-icon-color-child-active-hover"]=r.itemIconColorChildActiveHover,l["--n-item-icon-color-collapsed"]=r.itemIconColorCollapsed,l["--n-item-text-color-horizontal"]=r.itemTextColorHorizontal,l["--n-item-text-color-hover-horizontal"]=r.itemTextColorHoverHorizontal,l["--n-item-text-color-active-horizontal"]=r.itemTextColorActiveHorizontal,l["--n-item-text-color-child-active-horizontal"]=r.itemTextColorChildActiveHorizontal,l["--n-item-text-color-child-active-hover-horizontal"]=r.itemTextColorChildActiveHoverHorizontal,l["--n-item-text-color-active-hover-horizontal"]=r.itemTextColorActiveHoverHorizontal,l["--n-item-icon-color-horizontal"]=r.itemIconColorHorizontal,l["--n-item-icon-color-hover-horizontal"]=r.itemIconColorHoverHorizontal,l["--n-item-icon-color-active-horizontal"]=r.itemIconColorActiveHorizontal,l["--n-item-icon-color-active-hover-horizontal"]=r.itemIconColorActiveHoverHorizontal,l["--n-item-icon-color-child-active-horizontal"]=r.itemIconColorChildActiveHorizontal,l["--n-item-icon-color-child-active-hover-horizontal"]=r.itemIconColorChildActiveHoverHorizontal,l["--n-arrow-color"]=r.arrowColor,l["--n-arrow-color-hover"]=r.arrowColorHover,l["--n-arrow-color-active"]=r.arrowColorActive,l["--n-arrow-color-active-hover"]=r.arrowColorActiveHover,l["--n-arrow-color-child-active"]=r.arrowColorChildActive,l["--n-arrow-color-child-active-hover"]=r.arrowColorChildActiveHover,l["--n-item-color-hover"]=r.itemColorHover,l["--n-item-color-active"]=r.itemColorActive,l["--n-item-color-active-hover"]=r.itemColorActiveHover,l["--n-item-color-active-collapsed"]=r.itemColorActiveCollapsed),l}),p=t?ue("menu",w(()=>e.inverted?"a":"b"),d,e):void 0,H=Jo(),k=j(null),L=j(null);let T=!0;const V=()=>{var b;T?T=!1:(b=k.value)===null||b===void 0||b.sync({showAllItemsBeforeCalculate:!0})};function Q(){return document.getElementById(H)}const re=j(-1);function be(b){re.value=e.options.length-b}function xe(b){b||(re.value=-1)}const we=w(()=>{const b=re.value;return{children:b===-1?[]:e.options.slice(b)}}),Ce=w(()=>{const{childrenField:b,disabledField:I,keyField:r}=e;return Re([we.value],{getIgnored(y){return Ee(y)},getChildren(y){return y[b]},getDisabled(y){return y[I]},getKey(y){var N;return(N=y[r])!==null&&N!==void 0?N:y.name}})}),ye=w(()=>Re([{}]).treeNodes[0]);function ke(){var b;if(re.value===-1)return s(Pe,{root:!0,level:0,key:"__ellpisisGroupPlaceholder__",internalKey:"__ellpisisGroupPlaceholder__",title:"···",tmNode:ye.value,domId:H,isEllipsisPlaceholder:!0});const I=Ce.value.treeNodes[0],r=B.value,y=!!(!((b=I.children)===null||b===void 0)&&b.some(N=>r.includes(N.key)));return s(Pe,{level:0,root:!0,key:"__ellpisisGroup__",internalKey:"__ellpisisGroup__",title:"···",virtualChildActive:y,tmNode:I,domId:H,rawNodes:I.rawNode.children||[],tmNodes:I.children||[],isEllipsisPlaceholder:!0})}return{mergedClsPrefix:o,controlledExpandedKeys:P,uncontrolledExpanededKeys:g,mergedExpandedKeys:_,uncontrolledValue:x,mergedValue:C,activePath:B,tmNodes:M,mergedTheme:i,mergedCollapsed:a,cssVars:t?void 0:d,themeClass:p?.themeClass,overflowRef:k,counterRef:L,updateCounter:()=>{},onResize:V,onUpdateOverflow:xe,onUpdateCount:be,renderCounter:ke,getCounter:Q,onRender:p?.onRender,showOption:z,deriveResponsiveState:V}},render(){const{mergedClsPrefix:e,mode:o,themeClass:t,onRender:i}=this;i?.();const n=()=>this.tmNodes.map(u=>De(u,this.$props)),c=o==="horizontal"&&this.responsive,f=()=>s("div",oo(this.$attrs,{role:o==="horizontal"?"menubar":"menu",class:[`${e}-menu`,t,`${e}-menu--${o}`,c&&`${e}-menu--responsive`,this.mergedCollapsed&&`${e}-menu--collapsed`],style:this.cssVars}),c?s(dt,{ref:"overflowRef",onUpdateOverflow:this.onUpdateOverflow,getCounter:this.getCounter,onUpdateCount:this.onUpdateCount,updateCounter:this.updateCounter,style:{width:"100%",display:"flex",overflow:"hidden"}},{default:n,counter:this.renderCounter}):n());return c?s(qo,{onResize:this.onResize},{default:f}):f()}}),Qt={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Zt=$({name:"BusinessOutline",render:function(o,t){return F(),K("svg",Qt,t[0]||(t[0]=[pe('<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M176 416v64"></path><path d="M80 32h192a32 32 0 0 1 32 32v412a4 4 0 0 1-4 4H48h0V64a32 32 0 0 1 32-32z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path><path d="M320 192h112a32 32 0 0 1 32 32v256h0h-160h0V208a16 16 0 0 1 16-16z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path><path d="M98.08 431.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 351.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 271.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 191.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 111.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 351.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 271.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 191.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 111.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M258.08 431.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M258.08 351.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M258.08 271.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><ellipse cx="256" cy="176" rx="15.95" ry="16.03" transform="rotate(-45 255.99 175.996)" fill="currentColor"></ellipse><path d="M258.08 111.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M400 400a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M400 320a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M400 240a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M336 400a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M336 320a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M336 240a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path>',23)]))}}),er={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},or=$({name:"CalendarOutline",render:function(o,t){return F(),K("svg",er,t[0]||(t[0]=[pe('<rect fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" x="48" y="80" width="416" height="384" rx="48"></rect><circle cx="296" cy="232" r="24" fill="currentColor"></circle><circle cx="376" cy="232" r="24" fill="currentColor"></circle><circle cx="296" cy="312" r="24" fill="currentColor"></circle><circle cx="376" cy="312" r="24" fill="currentColor"></circle><circle cx="136" cy="312" r="24" fill="currentColor"></circle><circle cx="216" cy="312" r="24" fill="currentColor"></circle><circle cx="136" cy="392" r="24" fill="currentColor"></circle><circle cx="216" cy="392" r="24" fill="currentColor"></circle><circle cx="296" cy="392" r="24" fill="currentColor"></circle><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" stroke-linecap="round" d="M128 48v32"></path><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" stroke-linecap="round" d="M384 48v32"></path><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" d="M464 160H48"></path>',13)]))}}),tr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},wo=$({name:"CheckmarkOutline",render:function(o,t){return F(),K("svg",tr,t[0]||(t[0]=[R("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M416 128L192 384l-96-96"},null,-1)]))}}),rr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},nr=$({name:"ContrastOutline",render:function(o,t){return F(),K("svg",rr,t[0]||(t[0]=[R("circle",{cx:"256",cy:"256",r:"208",fill:"none",stroke:"currentColor","stroke-linejoin":"round","stroke-width":"32"},null,-1),R("path",{d:"M256 464c-114.88 0-208-93.12-208-208S141.12 48 256 48z",fill:"currentColor"},null,-1)]))}}),ir={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Je=$({name:"FolderOpenOutline",render:function(o,t){return F(),K("svg",ir,t[0]||(t[0]=[R("path",{d:"M64 192v-72a40 40 0 0 1 40-40h75.89a40 40 0 0 1 22.19 6.72l27.84 18.56a40 40 0 0 0 22.19 6.72H408a40 40 0 0 1 40 40v40",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),R("path",{d:"M479.9 226.55L463.68 392a40 40 0 0 1-39.93 40H88.25a40 40 0 0 1-39.93-40L32.1 226.55A32 32 0 0 1 64 192h384.1a32 32 0 0 1 31.8 34.55z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),lr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},ar=$({name:"GridOutline",render:function(o,t){return F(),K("svg",lr,t[0]||(t[0]=[R("rect",{x:"48",y:"48",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),R("rect",{x:"288",y:"48",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),R("rect",{x:"48",y:"288",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),R("rect",{x:"288",y:"288",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),sr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},cr=$({name:"LibraryOutline",render:function(o,t){return F(),K("svg",sr,t[0]||(t[0]=[pe('<rect x="32" y="96" width="64" height="368" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 224h128"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 400h128"></path><rect x="112" y="160" width="128" height="304" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><rect x="256" y="48" width="96" height="416" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><path d="M422.46 96.11l-40.4 4.25c-11.12 1.17-19.18 11.57-17.93 23.1l34.92 321.59c1.26 11.53 11.37 20 22.49 18.84l40.4-4.25c11.12-1.17 19.18-11.57 17.93-23.1L445 115c-1.31-11.58-11.42-20.06-22.54-18.89z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></path>',6)]))}}),dr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},ur=$({name:"LogOutOutline",render:function(o,t){return F(),K("svg",dr,t[0]||(t[0]=[R("path",{d:"M304 336v40a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V136a40 40 0 0 1 40-40h152c22.09 0 48 17.91 48 40v40",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),R("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M368 336l80-80l-80-80"},null,-1),R("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M176 256h256"},null,-1)]))}}),hr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},mr=$({name:"MenuOutline",render:function(o,t){return F(),K("svg",hr,t[0]||(t[0]=[R("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 160h352"},null,-1),R("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 256h352"},null,-1),R("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 352h352"},null,-1)]))}}),vr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Co=$({name:"MoonOutline",render:function(o,t){return F(),K("svg",vr,t[0]||(t[0]=[R("path",{d:"M160 136c0-30.62 4.51-61.61 16-88C99.57 81.27 48 159.32 48 248c0 119.29 96.71 216 216 216c88.68 0 166.73-51.57 200-128c-26.39 11.49-57.38 16-88 16c-119.29 0-216-96.71-216-216z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),fr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},pr=$({name:"PersonCircleOutline",render:function(o,t){return F(),K("svg",fr,t[0]||(t[0]=[R("path",{d:"M258.9 48C141.92 46.42 46.42 141.92 48 258.9c1.56 112.19 92.91 203.54 205.1 205.1c117 1.6 212.48-93.9 210.88-210.88C462.44 140.91 371.09 49.56 258.9 48zm126.42 327.25a4 4 0 0 1-6.14-.32a124.27 124.27 0 0 0-32.35-29.59C321.37 329 289.11 320 256 320s-65.37 9-90.83 25.34a124.24 124.24 0 0 0-32.35 29.58a4 4 0 0 1-6.14.32A175.32 175.32 0 0 1 80 259c-1.63-97.31 78.22-178.76 175.57-179S432 158.81 432 256a175.32 175.32 0 0 1-46.68 119.25z",fill:"currentColor"},null,-1),R("path",{d:"M256 144c-19.72 0-37.55 7.39-50.22 20.82s-19 32-17.57 51.93C191.11 256 221.52 288 256 288s64.83-32 67.79-71.24c1.48-19.74-4.8-38.14-17.68-51.82C293.39 151.44 275.59 144 256 144z",fill:"currentColor"},null,-1)]))}}),gr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},br=$({name:"SettingsOutline",render:function(o,t){return F(),K("svg",gr,t[0]||(t[0]=[R("path",{d:"M262.29 192.31a64 64 0 1 0 57.4 57.4a64.13 64.13 0 0 0-57.4-57.4zM416.39 256a154.34 154.34 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.48 164.48 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22a155.3 155.3 0 0 1-21.46-12.57a16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.48 164.48 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22a155.3 155.3 0 0 1 21.46 12.57a16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0-6.05 14.08c.33 4.14.55 8.3.55 12.47z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),xr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},yo=$({name:"SunnyOutline",render:function(o,t){return F(),K("svg",xr,t[0]||(t[0]=[pe('<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 48v48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 416v48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 108.92l-33.94 33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 369.14l-33.94 33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M464 256h-48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M96 256H48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 403.08l-33.94-33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 142.86l-33.94-33.94"></path><circle cx="256" cy="256" r="80" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"></circle>',9)]))}}),oe=e=>()=>s(fe,null,{default:()=>s(e)});function wr(e){const o=(n,a,c)=>({label:()=>s(Io,{to:{name:a},onClick:e.onNavigate},{default:()=>n}),key:a,...c?{icon:oe(c)}:{}}),i=[{key:"dashboard",build:()=>o("工作台","dashboard",ar)},{key:"memos",build:()=>o("备忘录","memos",rt)},{key:"warehouse",build:()=>e.isLiteMode?o("二级库","warehouse-lite",Ye):{label:"二级库",key:"warehouse-group",icon:oe(Ye),children:[o("库存查询","stock"),o("物资档案","stock-materials"),o("操作记录","operations"),...e.can("warehouse:write")?[o("入库","inbound"),o("出库","outbound")]:[]]}},{key:"huaxing_inventory",build:()=>o("华星总库存","hua-xing-stock",Zt)},{key:"procurement",build:()=>({label:"申购管理",key:"procurement-group",icon:oe(nt),children:[o("申购计划","purchase-materials"),o("周期性计划","purchase-plan-templates"),o("未编码物资","uncoded-materials"),o("物料编码库","material-code-library"),o("申购记录","purchase-records")]})},{key:"hazards",build:()=>({label:"隐患管理",key:"hazard-group",icon:oe(it),children:[o("隐患管理","hazard-records"),o("隐患类型","hazard-types"),o("责任单位","hazard-units")]})},{key:"ledger",build:()=>({label:"台账管理",key:"ledger-group",icon:oe(cr),children:[o("台账总览","ledger-items"),o("标签管理","ledger-tags")]})},{key:"work",build:()=>({label:"工作管理",key:"work-group",icon:oe(or),children:[o("工作总览","work-overview"),o("任务视图","work-tasks"),o("人员视图","work-workers")]})}].filter(n=>e.isFeatureVisible(n.key)).map(n=>n.build());return e.can("settings:write")&&i.push({label:"系统管理",key:"settings-group",icon:oe(br),children:[o("管理端用户","users"),o("小程序用户","mini-program-users"),o("项目管理","projects"),o("附件管理","attachments"),o("高级设置","advanced-settings"),o("分享链接","share-links"),o("关于","about")]}),i}const Cr={auto:"自动",light:"浅色",dark:"深色"},yr={auto:nr,light:yo,dark:Co},kr="外观",zr="theme-menu";function Sr(e){return ao.includes(e)}function _r(e,o,t){return[{label:kr,key:zr,icon:t(o?Co:yo),children:ao.map(i=>({key:i,label:Cr[i],icon:t(i===e?wo:yr[i])}))}]}const Ir="project-menu",Rr="项目：",Ke="project:",Mr="project:none",$r="暂无可用项目";function ko(e){return e.startsWith(Ke)}function Or(e){if(!ko(e))return null;const o=Number(e.slice(Ke.length));return Number.isInteger(o)&&o>0?o:null}function Qe(e){return e.name?.trim()||"未命名项目"}function Tr(e,o,t){const i=e.find(n=>n.id===o)??null;return[{label:`${Rr}${i?Qe(i):"未选择"}`,key:Ir,icon:t(Je),children:e.length?e.map(n=>({key:`${Ke}${n.id}`,label:Qe(n),icon:t(n.id===o?wo:Je)})):[{key:Mr,label:$r,disabled:!0}]}]}const Er={class:"user-menu-icon","aria-hidden":"true"},Pr={key:0,class:"user-summary"},Br={class:"user-name"},Nr={class:"user-role"},Ar={key:1,class:"user-menu-caret","aria-hidden":"true"},Hr=$({__name:"UserMenu",props:{collapsed:{type:Boolean},zIndex:{}},setup(e){const o=Ro(),t=so(),i=Qo(),n=Zo(),a=C=>()=>s(fe,null,{default:()=>s(C)}),c=w(()=>t.user?.display_name||t.user?.username||"未登录"),f=w(()=>t.user?et[t.user.role]:""),u=w(()=>[..._r(n.mode,n.isDark,a),...Tr(i.enabledProjects,i.currentProject?.id??null,a),{type:"divider",key:"logout-divider"},{label:"退出登录",key:"logout",icon:a(ur)}]);function x(C){if(C==="logout"){E();return}if(Sr(C)){n.setMode(C);return}if(ko(C)){const g=Or(C);g!==null&&i.select(g)}}function E(){t.logout(),i.clear(),o.push({name:"login"})}return(C,g)=>{const O=co;return F(),ne(O,{options:u.value,"z-index":e.zIndex,placement:"top-start",trigger:"click",onSelect:x},{default:X(()=>[R("button",{type:"button",class:ro(["user-menu-trigger",{compact:e.collapsed}]),"aria-label":"打开用户菜单"},[R("span",Er,[W(G(fe),{size:20},{default:X(()=>[W(G(pr))]),_:1})]),e.collapsed?te("",!0):(F(),K("span",Pr,[R("span",Br,Oe(c.value),1),R("span",Nr,Oe(f.value),1)])),e.collapsed?te("",!0):(F(),K("span",Ar))],2)]),_:1},8,["options","z-index"])}}}),Ze=uo(Hr,[["__scopeId","data-v-5f1afebc"]]),Fr=["src"],Lr={key:0},jr={class:"sider-user"},Dr={class:"mobile-title"},Kr={class:"drawer-brand"},Ur=["src"],Vr={class:"drawer-user"},Wr=$({__name:"AppLayout",setup(e){const o=$o(),t=so(),i=ot(),n=j(!1),a=tt("(max-width: 768px)"),c=j(!1),f=()=>{c.value=!1},u=w(()=>wr({isLiteMode:i.isLiteMode,can:E=>t.can(E),isFeatureVisible:E=>i.isFeatureVisible(E),onNavigate:f})),x={display:"flex",flexDirection:"column",overflow:"hidden"};return(E,C)=>{const g=Jt,O=jt,P=fe,_=Nt,M=Oo("router-view"),B=Et,Y=Tt,U=Rt;return F(),K(to,null,[W(Y,{"has-sider":!G(a),class:"app-shell"},{default:X(()=>[G(a)?te("",!0):(F(),ne(O,{key:0,bordered:"","collapse-mode":"width","collapsed-width":64,width:180,collapsed:n.value,"content-style":x,"show-trigger":"",onCollapse:C[0]||(C[0]=A=>n.value=!0),onExpand:C[1]||(C[1]=A=>n.value=!1)},{default:X(()=>[R("div",{class:ro(["brand",{compact:n.value}])},[R("img",{class:"brand-mark",src:G(Ge),alt:"系统 Logo"},null,8,Fr),n.value?te("",!0):(F(),K("span",Lr,"HXNI 电气无忧"))],2),W(g,{class:"sider-menu",collapsed:n.value,"collapsed-width":64,"collapsed-icon-size":22,options:u.value,value:String(G(o).name||"")},null,8,["collapsed","options","value"]),R("div",jr,[W(Ze,{collapsed:n.value},null,8,["collapsed"])])]),_:1},8,["collapsed"])),W(Y,null,{default:X(()=>[G(a)?(F(),ne(_,{key:0,bordered:"",class:"mobile-topbar"},{default:X(()=>[R("button",{type:"button",class:"menu-toggle","aria-label":"打开导航菜单",onClick:C[2]||(C[2]=A=>c.value=!0)},[W(P,{size:20},{default:X(()=>[W(G(mr))]),_:1})]),R("div",Dr,Oe(G(o).meta.title),1)]),_:1})):te("",!0),W(B,{class:"app-content","native-scrollbar":!1},{default:X(()=>[W(M,null,{default:X(({Component:A,route:z})=>[(F(),ne(Mo,{max:6},[z.meta.keepAlive?(F(),ne(Ve(A),{key:String(z.name)})):te("",!0)],1024)),z.meta.keepAlive?te("",!0):(F(),ne(Ve(A),{key:String(z.name)}))]),_:1})]),_:1})]),_:1})]),_:1},8,["has-sider"]),W(U,{show:c.value,"onUpdate:show":C[3]||(C[3]=A=>c.value=A),placement:"left",width:250,"z-index":2e3,"content-style":x,"aria-label":"导航菜单"},{default:X(()=>[R("div",Kr,[R("img",{class:"brand-mark",src:G(Ge),alt:"系统 Logo"},null,8,Ur),C[4]||(C[4]=R("span",null,"HXNI 电气无忧",-1))]),W(g,{class:"drawer-menu",options:u.value,value:String(G(o).name||""),"onUpdate:value":f},null,8,["options","value"]),R("div",Vr,[W(Ze,{"z-index":2001})])]),_:1},8,["show"])],64)}}}),un=uo(Wr,[["__scopeId","data-v-541faddc"]]);export{un as default};
