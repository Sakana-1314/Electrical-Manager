import{j as N,k as h,B as Ee,q as co,v as uo,D as qe,r as K,n as Pe,w as ho,b as Bo,c as x,i as Z,p as J,t as se,F as be,Q as j,R as W,a4 as Ne,$ as C,a5 as Oo,S as ie,U as L,W as T,a6 as le,h as ne,a3 as ee,G as No,E as mo,L as q,P as Ao,a7 as Je,a8 as Ho,a0 as Fo,V as Lo}from"./vendor-vue-vqiuIG17.js";import{F as jo,S as Ae,m as ce,A as Uo,C as Ko,D as vo,E as Do,G as Vo,H as Wo,I as Yo,g as p,J as we,e as v,f as P,h as g,K as Xo,L as Go,M as qo,n as Q,O as Jo,p as me,P as Qo,Q as Zo,w as Y,R as et,T as ot,U as tt,W as Qe,c as ve,X as po,N as fo,j as de,Y as rt,b as ae,Z as He,$ as Te,a0 as $e,a1 as nt,V as it,a2 as lt,a3 as at,x as Fe,a4 as go,a5 as st,B as ct,y as Ze,a6 as dt,a7 as ut,a8 as bo,a9 as ht,aa as mt,ab as vt,ac as pt,ad as ft}from"./index-DdpJiXO9.js";import{N as ge}from"./Icon-Byo_yi-U.js";import{D as gt,F as eo,C as bt,W as wt}from"./WarningOutline-DzXeu1Lc.js";import{_ as xt}from"./InputGroup-Ch032Lf7.js";import{_ as yt}from"./Divider-CSS04_ax.js";import{_ as Ct}from"./Space-Dsb25u2W.js";import{u as kt}from"./use-message-IKkB6i5L.js";import{_ as _t,a as zt}from"./FormItem-Boqhnt54.js";import{_ as St}from"./Input-C2qnmBuk.js";import{_ as Le}from"./_plugin-vue_export-helper-DlAUqK2U.js";import{C as It,_ as wo}from"./Dropdown-B4LSvJX2.js";import{a as oo}from"./branding-COIohYZq.js";import{u as he,a as Rt}from"./get-CbyS0LBV.js";import{d as $t,m as Mt}from"./light-CnbZR4FC.js";import{f as ue}from"./format-length-B-p6aW7q.js";import{N as Et}from"./Tooltip-BPP3ak-y.js";import{V as Pt,c as Me}from"./Popover-D01XT1UV.js";import"./light-OAfxQiXO.js";import"./light-e3bL_Rmm.js";import"./get-slot-Bk_rJcZu.js";import"./_common-h0mJDxlK.js";import"./light-DrlIxgm7.js";import"./use-locale-CN4CCzs8.js";import"./light-B9GKxIQb.js";import"./use-keyboard-wJNqXB3t.js";import"./light-B3w7fxnc.js";import"./light-B_QOoZUb.js";import"./light-BnNyYr3h.js";const Tt=N({name:"ChevronDownFilled",render(){return h("svg",{viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg"},h("path",{d:"M3.20041 5.73966C3.48226 5.43613 3.95681 5.41856 4.26034 5.70041L8 9.22652L11.7397 5.70041C12.0432 5.41856 12.5177 5.43613 12.7996 5.73966C13.0815 6.0432 13.0639 6.51775 12.7603 6.7996L8.51034 10.7996C8.22258 11.0668 7.77743 11.0668 7.48967 10.7996L3.23966 6.7996C2.93613 6.51775 2.91856 6.0432 3.20041 5.73966Z",fill:"currentColor"}))}}),Bt=N({name:"NDrawerContent",inheritAttrs:!1,props:{blockScroll:Boolean,show:{type:Boolean,default:void 0},displayDirective:{type:String,required:!0},placement:{type:String,required:!0},contentClass:String,contentStyle:[Object,String],nativeScrollbar:{type:Boolean,required:!0},scrollbarProps:Object,trapFocus:{type:Boolean,default:!0},autoFocus:{type:Boolean,default:!0},showMask:{type:[Boolean,String],required:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,onClickoutside:Function,onAfterLeave:Function,onAfterEnter:Function,onEsc:Function},setup(e){const o=K(!!e.show),t=K(null),n=Z(vo);let i=0,l="",s=null;const m=K(!1),c=K(!1),w=x(()=>e.placement==="top"||e.placement==="bottom"),{mergedClsPrefixRef:E,mergedRtlRef:k}=ce(e),u=Uo("Drawer",k,E),_=d,O=S=>{c.value=!0,i=w.value?S.clientY:S.clientX,l=document.body.style.cursor,document.body.style.cursor=w.value?"ns-resize":"ew-resize",document.body.addEventListener("mousemove",M),document.body.addEventListener("mouseleave",_),document.body.addEventListener("mouseup",d)},z=()=>{s!==null&&(window.clearTimeout(s),s=null),c.value?m.value=!0:s=window.setTimeout(()=>{m.value=!0},300)},$=()=>{s!==null&&(window.clearTimeout(s),s=null),m.value=!1},{doUpdateHeight:A,doUpdateWidth:G}=n,R=S=>{const{maxWidth:D}=e;if(D&&S>D)return D;const{minWidth:H}=e;return H&&S<H?H:S},b=S=>{const{maxHeight:D}=e;if(D&&S>D)return D;const{minHeight:H}=e;return H&&S<H?H:S};function M(S){var D,H;if(c.value)if(w.value){let X=((D=t.value)===null||D===void 0?void 0:D.offsetHeight)||0;const V=i-S.clientY;X+=e.placement==="bottom"?V:-V,X=b(X),A(X),i=S.clientY}else{let X=((H=t.value)===null||H===void 0?void 0:H.offsetWidth)||0;const V=i-S.clientX;X+=e.placement==="right"?V:-V,X=R(X),G(X),i=S.clientX}}function d(){c.value&&(i=0,c.value=!1,document.body.style.cursor=l,document.body.removeEventListener("mousemove",M),document.body.removeEventListener("mouseup",d),document.body.removeEventListener("mouseleave",_))}Pe(()=>{e.show&&(o.value=!0)}),ho(()=>e.show,S=>{S||d()}),Bo(()=>{d()});const f=x(()=>{const{show:S}=e,D=[[qe,S]];return e.showMask||D.push([Do,e.onClickoutside,void 0,{capture:!0}]),D});function F(){var S;o.value=!1,(S=e.onAfterLeave)===null||S===void 0||S.call(e)}return Ko(x(()=>e.blockScroll&&o.value)),J(Vo,t),J(Wo,null),J(Yo,null),{bodyRef:t,rtlEnabled:u,mergedClsPrefix:n.mergedClsPrefixRef,isMounted:n.isMountedRef,mergedTheme:n.mergedThemeRef,displayed:o,transitionName:x(()=>({right:"slide-in-from-right-transition",left:"slide-in-from-left-transition",top:"slide-in-from-top-transition",bottom:"slide-in-from-bottom-transition"})[e.placement]),handleAfterLeave:F,bodyDirectives:f,handleMousedownResizeTrigger:O,handleMouseenterResizeTrigger:z,handleMouseleaveResizeTrigger:$,isDragging:c,isHoverOnResizeTrigger:m}},render(){const{$slots:e,mergedClsPrefix:o}=this;return this.displayDirective==="show"||this.displayed||this.show?Ee(h("div",{role:"none"},h(jo,{disabled:!this.showMask||!this.trapFocus,active:this.show,autoFocus:this.autoFocus,onEsc:this.onEsc},{default:()=>h(co,{name:this.transitionName,appear:this.isMounted,onAfterEnter:this.onAfterEnter,onAfterLeave:this.handleAfterLeave},{default:()=>Ee(h("div",uo(this.$attrs,{role:"dialog",ref:"bodyRef","aria-modal":"true",class:[`${o}-drawer`,this.rtlEnabled&&`${o}-drawer--rtl`,`${o}-drawer--${this.placement}-placement`,this.isDragging&&`${o}-drawer--unselectable`,this.nativeScrollbar&&`${o}-drawer--native-scrollbar`]}),[this.resizable?h("div",{class:[`${o}-drawer__resize-trigger`,(this.isDragging||this.isHoverOnResizeTrigger)&&`${o}-drawer__resize-trigger--hover`],onMouseenter:this.handleMouseenterResizeTrigger,onMouseleave:this.handleMouseleaveResizeTrigger,onMousedown:this.handleMousedownResizeTrigger}):null,this.nativeScrollbar?h("div",{class:[`${o}-drawer-content-wrapper`,this.contentClass],style:this.contentStyle,role:"none"},e):h(Ae,Object.assign({},this.scrollbarProps,{contentStyle:this.contentStyle,contentClass:[`${o}-drawer-content-wrapper`,this.contentClass],theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar}),e)]),this.bodyDirectives)})})),[[qe,this.displayDirective==="if"||this.displayed||this.show]]):null}}),{cubicBezierEaseIn:Ot,cubicBezierEaseOut:Nt}=we;function At({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-bottom"}={}){return[p(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${Ot}`}),p(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${Nt}`}),p(`&.${t}-transition-enter-to`,{transform:"translateY(0)"}),p(`&.${t}-transition-enter-from`,{transform:"translateY(100%)"}),p(`&.${t}-transition-leave-from`,{transform:"translateY(0)"}),p(`&.${t}-transition-leave-to`,{transform:"translateY(100%)"})]}const{cubicBezierEaseIn:Ht,cubicBezierEaseOut:Ft}=we;function Lt({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-left"}={}){return[p(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${Ht}`}),p(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${Ft}`}),p(`&.${t}-transition-enter-to`,{transform:"translateX(0)"}),p(`&.${t}-transition-enter-from`,{transform:"translateX(-100%)"}),p(`&.${t}-transition-leave-from`,{transform:"translateX(0)"}),p(`&.${t}-transition-leave-to`,{transform:"translateX(-100%)"})]}const{cubicBezierEaseIn:jt,cubicBezierEaseOut:Ut}=we;function Kt({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-right"}={}){return[p(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${jt}`}),p(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${Ut}`}),p(`&.${t}-transition-enter-to`,{transform:"translateX(0)"}),p(`&.${t}-transition-enter-from`,{transform:"translateX(100%)"}),p(`&.${t}-transition-leave-from`,{transform:"translateX(0)"}),p(`&.${t}-transition-leave-to`,{transform:"translateX(100%)"})]}const{cubicBezierEaseIn:Dt,cubicBezierEaseOut:Vt}=we;function Wt({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-top"}={}){return[p(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${Dt}`}),p(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${Vt}`}),p(`&.${t}-transition-enter-to`,{transform:"translateY(0)"}),p(`&.${t}-transition-enter-from`,{transform:"translateY(-100%)"}),p(`&.${t}-transition-leave-from`,{transform:"translateY(0)"}),p(`&.${t}-transition-leave-to`,{transform:"translateY(-100%)"})]}const Yt=p([v("drawer",`
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
 `,[Kt(),Lt(),Wt(),At(),P("unselectable",`
 user-select: none; 
 -webkit-user-select: none;
 `),P("native-scrollbar",[v("drawer-content-wrapper",`
 overflow: auto;
 height: 100%;
 `)]),g("resize-trigger",`
 position: absolute;
 background-color: #0000;
 transition: background-color .3s var(--n-bezier);
 `,[P("hover",`
 background-color: var(--n-resize-trigger-color-hover);
 `)]),v("drawer-content-wrapper",`
 box-sizing: border-box;
 `),v("drawer-content",`
 height: 100%;
 display: flex;
 flex-direction: column;
 `,[P("native-scrollbar",[v("drawer-body-content-wrapper",`
 height: 100%;
 overflow: auto;
 `)]),v("drawer-body",`
 flex: 1 0 0;
 overflow: hidden;
 `),v("drawer-body-content-wrapper",`
 box-sizing: border-box;
 padding: var(--n-body-padding);
 `),v("drawer-header",`
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
 `,[g("main",`
 flex: 1;
 `),g("close",`
 margin-left: 6px;
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `)]),v("drawer-footer",`
 display: flex;
 justify-content: flex-end;
 border-top: var(--n-footer-border-top);
 transition: border .3s var(--n-bezier);
 padding: var(--n-footer-padding);
 `)]),P("right-placement",`
 top: 0;
 bottom: 0;
 right: 0;
 border-top-left-radius: var(--n-border-radius);
 border-bottom-left-radius: var(--n-border-radius);
 `,[g("resize-trigger",`
 width: 3px;
 height: 100%;
 top: 0;
 left: 0;
 transform: translateX(-1.5px);
 cursor: ew-resize;
 `)]),P("left-placement",`
 top: 0;
 bottom: 0;
 left: 0;
 border-top-right-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `,[g("resize-trigger",`
 width: 3px;
 height: 100%;
 top: 0;
 right: 0;
 transform: translateX(1.5px);
 cursor: ew-resize;
 `)]),P("top-placement",`
 top: 0;
 left: 0;
 right: 0;
 border-bottom-left-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `,[g("resize-trigger",`
 width: 100%;
 height: 3px;
 bottom: 0;
 left: 0;
 transform: translateY(1.5px);
 cursor: ns-resize;
 `)]),P("bottom-placement",`
 left: 0;
 bottom: 0;
 right: 0;
 border-top-left-radius: var(--n-border-radius);
 border-top-right-radius: var(--n-border-radius);
 `,[g("resize-trigger",`
 width: 100%;
 height: 3px;
 top: 0;
 left: 0;
 transform: translateY(-1.5px);
 cursor: ns-resize;
 `)])]),p("body",[p(">",[v("drawer-container",`
 position: fixed;
 `)])]),v("drawer-container",`
 position: relative;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 pointer-events: none;
 `,[p("> *",`
 pointer-events: all;
 `)]),v("drawer-mask",`
 background-color: rgba(0, 0, 0, .3);
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `,[P("invisible",`
 background-color: rgba(0, 0, 0, 0)
 `),Xo({enterDuration:"0.2s",leaveDuration:"0.2s",enterCubicBezier:"var(--n-bezier-in)",leaveCubicBezier:"var(--n-bezier-out)"})])]),Xt=Object.assign(Object.assign({},Q.props),{show:Boolean,width:[Number,String],height:[Number,String],placement:{type:String,default:"right"},maskClosable:{type:Boolean,default:!0},showMask:{type:[Boolean,String],default:!0},to:[String,Object],displayDirective:{type:String,default:"if"},nativeScrollbar:{type:Boolean,default:!0},zIndex:Number,onMaskClick:Function,scrollbarProps:Object,contentClass:String,contentStyle:[Object,String],trapFocus:{type:Boolean,default:!0},onEsc:Function,autoFocus:{type:Boolean,default:!0},closeOnEsc:{type:Boolean,default:!0},blockScroll:{type:Boolean,default:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,defaultWidth:{type:[Number,String],default:251},defaultHeight:{type:[Number,String],default:251},onUpdateWidth:[Function,Array],onUpdateHeight:[Function,Array],"onUpdate:width":[Function,Array],"onUpdate:height":[Function,Array],"onUpdate:show":[Function,Array],onUpdateShow:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,drawerStyle:[String,Object],drawerClass:String,target:null,onShow:Function,onHide:Function}),Gt=N({name:"Drawer",inheritAttrs:!1,props:Xt,setup(e){const{mergedClsPrefixRef:o,namespaceRef:t,inlineThemeDisabled:n}=ce(e),i=qo(),l=Q("Drawer","-drawer",Yt,$t,e,o),s=K(e.defaultWidth),m=K(e.defaultHeight),c=he(se(e,"width"),s),w=he(se(e,"height"),m),E=x(()=>{const{placement:d}=e;return d==="top"||d==="bottom"?"":ue(c.value)}),k=x(()=>{const{placement:d}=e;return d==="left"||d==="right"?"":ue(w.value)}),u=d=>{const{onUpdateWidth:f,"onUpdate:width":F}=e;f&&Y(f,d),F&&Y(F,d),s.value=d},_=d=>{const{onUpdateHeight:f,"onUpdate:width":F}=e;f&&Y(f,d),F&&Y(F,d),m.value=d},O=x(()=>[{width:E.value,height:k.value},e.drawerStyle||""]);function z(d){const{onMaskClick:f,maskClosable:F}=e;F&&R(!1),f&&f(d)}function $(d){z(d)}const A=Jo();function G(d){var f;(f=e.onEsc)===null||f===void 0||f.call(e),e.show&&e.closeOnEsc&&Zo(d)&&(A.value||R(!1))}function R(d){const{onHide:f,onUpdateShow:F,"onUpdate:show":S}=e;F&&Y(F,d),S&&Y(S,d),f&&!d&&Y(f,d)}J(vo,{isMountedRef:i,mergedThemeRef:l,mergedClsPrefixRef:o,doUpdateShow:R,doUpdateHeight:_,doUpdateWidth:u});const b=x(()=>{const{common:{cubicBezierEaseInOut:d,cubicBezierEaseIn:f,cubicBezierEaseOut:F},self:{color:S,textColor:D,boxShadow:H,lineHeight:X,headerPadding:V,footerPadding:re,borderRadius:xe,bodyPadding:ye,titleFontSize:Ce,titleTextColor:ke,titleFontWeight:_e,headerBorderBottom:ze,footerBorderTop:y,closeIconColor:B,closeIconColorHover:r,closeIconColorPressed:I,closeColorHover:U,closeColorPressed:Se,closeIconSize:Ie,closeSize:Re,closeBorderRadius:a,resizableTriggerColorHover:To}}=l.value;return{"--n-line-height":X,"--n-color":S,"--n-border-radius":xe,"--n-text-color":D,"--n-box-shadow":H,"--n-bezier":d,"--n-bezier-out":F,"--n-bezier-in":f,"--n-header-padding":V,"--n-body-padding":ye,"--n-footer-padding":re,"--n-title-text-color":ke,"--n-title-font-size":Ce,"--n-title-font-weight":_e,"--n-header-border-bottom":ze,"--n-footer-border-top":y,"--n-close-icon-color":B,"--n-close-icon-color-hover":r,"--n-close-icon-color-pressed":I,"--n-close-size":Re,"--n-close-color-hover":U,"--n-close-color-pressed":Se,"--n-close-icon-size":Ie,"--n-close-border-radius":a,"--n-resize-trigger-color-hover":To}}),M=n?me("drawer",void 0,b,e):void 0;return{mergedClsPrefix:o,namespace:t,mergedBodyStyle:O,handleOutsideClick:$,handleMaskClick:z,handleEsc:G,mergedTheme:l,cssVars:n?void 0:b,themeClass:M?.themeClass,onRender:M?.onRender,isMounted:i}},render(){const{mergedClsPrefix:e}=this;return h(Go,{to:this.to,show:this.show},{default:()=>{var o;return(o=this.onRender)===null||o===void 0||o.call(this),Ee(h("div",{class:[`${e}-drawer-container`,this.namespace,this.themeClass],style:this.cssVars,role:"none"},this.showMask?h(co,{name:"fade-in-transition",appear:this.isMounted},{default:()=>this.show?h("div",{"aria-hidden":!0,class:[`${e}-drawer-mask`,this.showMask==="transparent"&&`${e}-drawer-mask--invisible`],onClick:this.handleMaskClick}):null}):null,h(Bt,Object.assign({},this.$attrs,{class:[this.drawerClass,this.$attrs.class],style:[this.mergedBodyStyle,this.$attrs.style],blockScroll:this.blockScroll,contentStyle:this.contentStyle,contentClass:this.contentClass,placement:this.placement,scrollbarProps:this.scrollbarProps,show:this.show,displayDirective:this.displayDirective,nativeScrollbar:this.nativeScrollbar,onAfterEnter:this.onAfterEnter,onAfterLeave:this.onAfterLeave,trapFocus:this.trapFocus,autoFocus:this.autoFocus,resizable:this.resizable,maxHeight:this.maxHeight,minHeight:this.minHeight,maxWidth:this.maxWidth,minWidth:this.minWidth,showMask:this.showMask,onEsc:this.handleEsc,onClickoutside:this.handleOutsideClick}),this.$slots)),[[Qo,{zIndex:this.zIndex,enabled:this.show}]])}})}});function qt(e){const{baseColor:o,textColor2:t,bodyColor:n,cardColor:i,dividerColor:l,actionColor:s,scrollbarColor:m,scrollbarColorHover:c,invertedColor:w}=e;return{textColor:t,textColorInverted:"#FFF",color:n,colorEmbedded:s,headerColor:i,headerColorInverted:w,footerColor:s,footerColorInverted:w,headerBorderColor:l,headerBorderColorInverted:w,footerBorderColor:l,footerBorderColorInverted:w,siderBorderColor:l,siderBorderColorInverted:w,siderColor:i,siderColorInverted:w,siderToggleButtonBorder:`1px solid ${l}`,siderToggleButtonColor:o,siderToggleButtonIconColor:t,siderToggleButtonIconColorInverted:t,siderToggleBarColor:Qe(n,m),siderToggleBarColorHover:Qe(n,c),__invertScrollbar:"true"}}const je=et({name:"Layout",common:tt,peers:{Scrollbar:ot},self:qt}),xo=ve("n-layout-sider"),Ue={type:String,default:"static"},Jt=v("layout",`
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
`,[v("layout-scroll-container",`
 overflow-x: hidden;
 box-sizing: border-box;
 height: 100%;
 `),P("absolute-positioned",`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),Qt={embedded:Boolean,position:Ue,nativeScrollbar:{type:Boolean,default:!0},scrollbarProps:Object,onScroll:Function,contentClass:String,contentStyle:{type:[String,Object],default:""},hasSider:Boolean,siderPlacement:{type:String,default:"left"}},yo=ve("n-layout");function Co(e){return N({name:e?"LayoutContent":"Layout",props:Object.assign(Object.assign({},Q.props),Qt),setup(o){const t=K(null),n=K(null),{mergedClsPrefixRef:i,inlineThemeDisabled:l}=ce(o),s=Q("Layout","-layout",Jt,je,o,i);function m(z,$){if(o.nativeScrollbar){const{value:A}=t;A&&($===void 0?A.scrollTo(z):A.scrollTo(z,$))}else{const{value:A}=n;A&&A.scrollTo(z,$)}}J(yo,o);let c=0,w=0;const E=z=>{var $;const A=z.target;c=A.scrollLeft,w=A.scrollTop,($=o.onScroll)===null||$===void 0||$.call(o,z)};po(()=>{if(o.nativeScrollbar){const z=t.value;z&&(z.scrollTop=w,z.scrollLeft=c)}});const k={display:"flex",flexWrap:"nowrap",width:"100%",flexDirection:"row"},u={scrollTo:m},_=x(()=>{const{common:{cubicBezierEaseInOut:z},self:$}=s.value;return{"--n-bezier":z,"--n-color":o.embedded?$.colorEmbedded:$.color,"--n-text-color":$.textColor}}),O=l?me("layout",x(()=>o.embedded?"e":""),_,o):void 0;return Object.assign({mergedClsPrefix:i,scrollableElRef:t,scrollbarInstRef:n,hasSiderStyle:k,mergedTheme:s,handleNativeElScroll:E,cssVars:l?void 0:_,themeClass:O?.themeClass,onRender:O?.onRender},u)},render(){var o;const{mergedClsPrefix:t,hasSider:n}=this;(o=this.onRender)===null||o===void 0||o.call(this);const i=n?this.hasSiderStyle:void 0,l=[this.themeClass,e&&`${t}-layout-content`,`${t}-layout`,`${t}-layout--${this.position}-positioned`];return h("div",{class:l,style:this.cssVars},this.nativeScrollbar?h("div",{ref:"scrollableElRef",class:[`${t}-layout-scroll-container`,this.contentClass],style:[this.contentStyle,i],onScroll:this.handleNativeElScroll},this.$slots):h(Ae,Object.assign({},this.scrollbarProps,{onScroll:this.onScroll,ref:"scrollbarInstRef",theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,contentClass:this.contentClass,contentStyle:[this.contentStyle,i]}),this.$slots))}})}const Zt=Co(!1),er=Co(!0),or=v("layout-header",`
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 box-sizing: border-box;
 width: 100%;
 background-color: var(--n-color);
 color: var(--n-text-color);
`,[P("absolute-positioned",`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 `),P("bordered",`
 border-bottom: solid 1px var(--n-border-color);
 `)]),tr={position:Ue,inverted:Boolean,bordered:{type:Boolean,default:!1}},rr=N({name:"LayoutHeader",props:Object.assign(Object.assign({},Q.props),tr),setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:t}=ce(e),n=Q("Layout","-layout-header",or,je,e,o),i=x(()=>{const{common:{cubicBezierEaseInOut:s},self:m}=n.value,c={"--n-bezier":s};return e.inverted?(c["--n-color"]=m.headerColorInverted,c["--n-text-color"]=m.textColorInverted,c["--n-border-color"]=m.headerBorderColorInverted):(c["--n-color"]=m.headerColor,c["--n-text-color"]=m.textColor,c["--n-border-color"]=m.headerBorderColor),c}),l=t?me("layout-header",x(()=>e.inverted?"a":"b"),i,e):void 0;return{mergedClsPrefix:o,cssVars:t?void 0:i,themeClass:l?.themeClass,onRender:l?.onRender}},render(){var e;const{mergedClsPrefix:o}=this;return(e=this.onRender)===null||e===void 0||e.call(this),h("div",{class:[`${o}-layout-header`,this.themeClass,this.position&&`${o}-layout-header--${this.position}-positioned`,this.bordered&&`${o}-layout-header--bordered`],style:this.cssVars},this.$slots)}}),nr=v("layout-sider",`
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
`,[P("bordered",[g("border",`
 content: "";
 position: absolute;
 top: 0;
 bottom: 0;
 width: 1px;
 background-color: var(--n-border-color);
 transition: background-color .3s var(--n-bezier);
 `)]),g("left-placement",[P("bordered",[g("border",`
 right: 0;
 `)])]),P("right-placement",`
 justify-content: flex-start;
 `,[P("bordered",[g("border",`
 left: 0;
 `)]),P("collapsed",[v("layout-toggle-button",[v("base-icon",`
 transform: rotate(180deg);
 `)]),v("layout-toggle-bar",[p("&:hover",[g("top",{transform:"rotate(-12deg) scale(1.15) translateY(-2px)"}),g("bottom",{transform:"rotate(12deg) scale(1.15) translateY(2px)"})])])]),v("layout-toggle-button",`
 left: 0;
 transform: translateX(-50%) translateY(-50%);
 `,[v("base-icon",`
 transform: rotate(0);
 `)]),v("layout-toggle-bar",`
 left: -28px;
 transform: rotate(180deg);
 `,[p("&:hover",[g("top",{transform:"rotate(12deg) scale(1.15) translateY(-2px)"}),g("bottom",{transform:"rotate(-12deg) scale(1.15) translateY(2px)"})])])]),P("collapsed",[v("layout-toggle-bar",[p("&:hover",[g("top",{transform:"rotate(-12deg) scale(1.15) translateY(-2px)"}),g("bottom",{transform:"rotate(12deg) scale(1.15) translateY(2px)"})])]),v("layout-toggle-button",[v("base-icon",`
 transform: rotate(0);
 `)])]),v("layout-toggle-button",`
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
 `,[v("base-icon",`
 transition: transform .3s var(--n-bezier);
 transform: rotate(180deg);
 `)]),v("layout-toggle-bar",`
 cursor: pointer;
 height: 72px;
 width: 32px;
 position: absolute;
 top: calc(50% - 36px);
 right: -28px;
 `,[g("top, bottom",`
 position: absolute;
 width: 4px;
 border-radius: 2px;
 height: 38px;
 left: 14px;
 transition: 
 background-color .3s var(--n-bezier),
 transform .3s var(--n-bezier);
 `),g("bottom",`
 position: absolute;
 top: 34px;
 `),p("&:hover",[g("top",{transform:"rotate(12deg) scale(1.15) translateY(-2px)"}),g("bottom",{transform:"rotate(-12deg) scale(1.15) translateY(2px)"})]),g("top, bottom",{backgroundColor:"var(--n-toggle-bar-color)"}),p("&:hover",[g("top, bottom",{backgroundColor:"var(--n-toggle-bar-color-hover)"})])]),g("border",`
 position: absolute;
 top: 0;
 right: 0;
 bottom: 0;
 width: 1px;
 transition: background-color .3s var(--n-bezier);
 `),v("layout-sider-scroll-container",`
 flex-grow: 1;
 flex-shrink: 0;
 box-sizing: border-box;
 height: 100%;
 opacity: 0;
 transition: opacity .3s var(--n-bezier);
 max-width: 100%;
 `),P("show-content",[v("layout-sider-scroll-container",{opacity:1})]),P("absolute-positioned",`
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 `)]),ir=N({props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){const{clsPrefix:e}=this;return h("div",{onClick:this.onClick,class:`${e}-layout-toggle-bar`},h("div",{class:`${e}-layout-toggle-bar__top`}),h("div",{class:`${e}-layout-toggle-bar__bottom`}))}}),lr=N({name:"LayoutToggleButton",props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){const{clsPrefix:e}=this;return h("div",{class:`${e}-layout-toggle-button`,onClick:this.onClick},h(fo,{clsPrefix:e},{default:()=>h(It,null)}))}}),ar={position:Ue,bordered:Boolean,collapsedWidth:{type:Number,default:48},width:{type:[Number,String],default:272},contentClass:String,contentStyle:{type:[String,Object],default:""},collapseMode:{type:String,default:"transform"},collapsed:{type:Boolean,default:void 0},defaultCollapsed:Boolean,showCollapsedContent:{type:Boolean,default:!0},showTrigger:{type:[Boolean,String],default:!1},nativeScrollbar:{type:Boolean,default:!0},inverted:Boolean,scrollbarProps:Object,triggerClass:String,triggerStyle:[String,Object],collapsedTriggerClass:String,collapsedTriggerStyle:[String,Object],"onUpdate:collapsed":[Function,Array],onUpdateCollapsed:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,onExpand:[Function,Array],onCollapse:[Function,Array],onScroll:Function},sr=N({name:"LayoutSider",props:Object.assign(Object.assign({},Q.props),ar),setup(e){const o=Z(yo),t=K(null),n=K(null),i=K(e.defaultCollapsed),l=he(se(e,"collapsed"),i),s=x(()=>ue(l.value?e.collapsedWidth:e.width)),m=x(()=>e.collapseMode!=="transform"?{}:{minWidth:ue(e.width)}),c=x(()=>o?o.siderPlacement:"left");function w(M,d){if(e.nativeScrollbar){const{value:f}=t;f&&(d===void 0?f.scrollTo(M):f.scrollTo(M,d))}else{const{value:f}=n;f&&f.scrollTo(M,d)}}function E(){const{"onUpdate:collapsed":M,onUpdateCollapsed:d,onExpand:f,onCollapse:F}=e,{value:S}=l;d&&Y(d,!S),M&&Y(M,!S),i.value=!S,S?f&&Y(f):F&&Y(F)}let k=0,u=0;const _=M=>{var d;const f=M.target;k=f.scrollLeft,u=f.scrollTop,(d=e.onScroll)===null||d===void 0||d.call(e,M)};po(()=>{if(e.nativeScrollbar){const M=t.value;M&&(M.scrollTop=u,M.scrollLeft=k)}}),J(xo,{collapsedRef:l,collapseModeRef:se(e,"collapseMode")});const{mergedClsPrefixRef:O,inlineThemeDisabled:z}=ce(e),$=Q("Layout","-layout-sider",nr,je,e,O);function A(M){var d,f;M.propertyName==="max-width"&&(l.value?(d=e.onAfterLeave)===null||d===void 0||d.call(e):(f=e.onAfterEnter)===null||f===void 0||f.call(e))}const G={scrollTo:w},R=x(()=>{const{common:{cubicBezierEaseInOut:M},self:d}=$.value,{siderToggleButtonColor:f,siderToggleButtonBorder:F,siderToggleBarColor:S,siderToggleBarColorHover:D}=d,H={"--n-bezier":M,"--n-toggle-button-color":f,"--n-toggle-button-border":F,"--n-toggle-bar-color":S,"--n-toggle-bar-color-hover":D};return e.inverted?(H["--n-color"]=d.siderColorInverted,H["--n-text-color"]=d.textColorInverted,H["--n-border-color"]=d.siderBorderColorInverted,H["--n-toggle-button-icon-color"]=d.siderToggleButtonIconColorInverted,H.__invertScrollbar=d.__invertScrollbar):(H["--n-color"]=d.siderColor,H["--n-text-color"]=d.textColor,H["--n-border-color"]=d.siderBorderColor,H["--n-toggle-button-icon-color"]=d.siderToggleButtonIconColor),H}),b=z?me("layout-sider",x(()=>e.inverted?"a":"b"),R,e):void 0;return Object.assign({scrollableElRef:t,scrollbarInstRef:n,mergedClsPrefix:O,mergedTheme:$,styleMaxWidth:s,mergedCollapsed:l,scrollContainerStyle:m,siderPlacement:c,handleNativeElScroll:_,handleTransitionend:A,handleTriggerClick:E,inlineThemeDisabled:z,cssVars:R,themeClass:b?.themeClass,onRender:b?.onRender},G)},render(){var e;const{mergedClsPrefix:o,mergedCollapsed:t,showTrigger:n}=this;return(e=this.onRender)===null||e===void 0||e.call(this),h("aside",{class:[`${o}-layout-sider`,this.themeClass,`${o}-layout-sider--${this.position}-positioned`,`${o}-layout-sider--${this.siderPlacement}-placement`,this.bordered&&`${o}-layout-sider--bordered`,t&&`${o}-layout-sider--collapsed`,(!t||this.showCollapsedContent)&&`${o}-layout-sider--show-content`],onTransitionend:this.handleTransitionend,style:[this.inlineThemeDisabled?void 0:this.cssVars,{maxWidth:this.styleMaxWidth,width:ue(this.width)}]},this.nativeScrollbar?h("div",{class:[`${o}-layout-sider-scroll-container`,this.contentClass],onScroll:this.handleNativeElScroll,style:[this.scrollContainerStyle,{overflow:"auto"},this.contentStyle],ref:"scrollableElRef"},this.$slots):h(Ae,Object.assign({},this.scrollbarProps,{onScroll:this.onScroll,ref:"scrollbarInstRef",style:this.scrollContainerStyle,contentStyle:this.contentStyle,contentClass:this.contentClass,theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,builtinThemeOverrides:this.inverted&&this.cssVars.__invertScrollbar==="true"?{colorHover:"rgba(255, 255, 255, .4)",color:"rgba(255, 255, 255, .3)"}:void 0}),this.$slots),n?n==="bar"?h(ir,{clsPrefix:o,class:t?this.collapsedTriggerClass:this.triggerClass,style:t?this.collapsedTriggerStyle:this.triggerStyle,onClick:this.handleTriggerClick}):h(lr,{clsPrefix:o,class:t?this.collapsedTriggerClass:this.triggerClass,style:t?this.collapsedTriggerStyle:this.triggerStyle,onClick:this.handleTriggerClick}):null,this.bordered?h("div",{class:`${o}-layout-sider__border`}):null)}}),pe=ve("n-menu"),ko=ve("n-submenu"),Ke=ve("n-menu-item-group"),to=[p("&::before","background-color: var(--n-item-color-hover);"),g("arrow",`
 color: var(--n-arrow-color-hover);
 `),g("icon",`
 color: var(--n-item-icon-color-hover);
 `),v("menu-item-content-header",`
 color: var(--n-item-text-color-hover);
 `,[p("a",`
 color: var(--n-item-text-color-hover);
 `),g("extra",`
 color: var(--n-item-text-color-hover);
 `)])],ro=[g("icon",`
 color: var(--n-item-icon-color-hover-horizontal);
 `),v("menu-item-content-header",`
 color: var(--n-item-text-color-hover-horizontal);
 `,[p("a",`
 color: var(--n-item-text-color-hover-horizontal);
 `),g("extra",`
 color: var(--n-item-text-color-hover-horizontal);
 `)])],cr=p([v("menu",`
 background-color: var(--n-color);
 color: var(--n-item-text-color);
 overflow: hidden;
 transition: background-color .3s var(--n-bezier);
 box-sizing: border-box;
 font-size: var(--n-font-size);
 padding-bottom: 6px;
 `,[P("horizontal",`
 max-width: 100%;
 width: 100%;
 display: flex;
 overflow: hidden;
 padding-bottom: 0;
 `,[v("submenu","margin: 0;"),v("menu-item","margin: 0;"),v("menu-item-content",`
 padding: 0 20px;
 border-bottom: 2px solid #0000;
 `,[p("&::before","display: none;"),P("selected","border-bottom: 2px solid var(--n-border-color-horizontal)")]),v("menu-item-content",[P("selected",[g("icon","color: var(--n-item-icon-color-active-horizontal);"),v("menu-item-content-header",`
 color: var(--n-item-text-color-active-horizontal);
 `,[p("a","color: var(--n-item-text-color-active-horizontal);"),g("extra","color: var(--n-item-text-color-active-horizontal);")])]),P("child-active",`
 border-bottom: 2px solid var(--n-border-color-horizontal);
 `,[v("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-horizontal);
 `,[p("a",`
 color: var(--n-item-text-color-child-active-horizontal);
 `),g("extra",`
 color: var(--n-item-text-color-child-active-horizontal);
 `)]),g("icon",`
 color: var(--n-item-icon-color-child-active-horizontal);
 `)]),de("disabled",[de("selected, child-active",[p("&:focus-within",ro)]),P("selected",[oe(null,[g("icon","color: var(--n-item-icon-color-active-hover-horizontal);"),v("menu-item-content-header",`
 color: var(--n-item-text-color-active-hover-horizontal);
 `,[p("a","color: var(--n-item-text-color-active-hover-horizontal);"),g("extra","color: var(--n-item-text-color-active-hover-horizontal);")])])]),P("child-active",[oe(null,[g("icon","color: var(--n-item-icon-color-child-active-hover-horizontal);"),v("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-hover-horizontal);
 `,[p("a","color: var(--n-item-text-color-child-active-hover-horizontal);"),g("extra","color: var(--n-item-text-color-child-active-hover-horizontal);")])])]),oe("border-bottom: 2px solid var(--n-border-color-horizontal);",ro)]),v("menu-item-content-header",[p("a","color: var(--n-item-text-color-horizontal);")])])]),de("responsive",[v("menu-item-content-header",`
 overflow: hidden;
 text-overflow: ellipsis;
 `)]),P("collapsed",[v("menu-item-content",[P("selected",[p("&::before",`
 background-color: var(--n-item-color-active-collapsed) !important;
 `)]),v("menu-item-content-header","opacity: 0;"),g("arrow","opacity: 0;"),g("icon","color: var(--n-item-icon-color-collapsed);")])]),v("menu-item",`
 height: var(--n-item-height);
 margin-top: 6px;
 position: relative;
 `),v("menu-item-content",`
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
 `,[p("> *","z-index: 1;"),p("&::before",`
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
 `),P("disabled",`
 opacity: .45;
 cursor: not-allowed;
 `),P("collapsed",[g("arrow","transform: rotate(0);")]),P("selected",[p("&::before","background-color: var(--n-item-color-active);"),g("arrow","color: var(--n-arrow-color-active);"),g("icon","color: var(--n-item-icon-color-active);"),v("menu-item-content-header",`
 color: var(--n-item-text-color-active);
 `,[p("a","color: var(--n-item-text-color-active);"),g("extra","color: var(--n-item-text-color-active);")])]),P("child-active",[v("menu-item-content-header",`
 color: var(--n-item-text-color-child-active);
 `,[p("a",`
 color: var(--n-item-text-color-child-active);
 `),g("extra",`
 color: var(--n-item-text-color-child-active);
 `)]),g("arrow",`
 color: var(--n-arrow-color-child-active);
 `),g("icon",`
 color: var(--n-item-icon-color-child-active);
 `)]),de("disabled",[de("selected, child-active",[p("&:focus-within",to)]),P("selected",[oe(null,[g("arrow","color: var(--n-arrow-color-active-hover);"),g("icon","color: var(--n-item-icon-color-active-hover);"),v("menu-item-content-header",`
 color: var(--n-item-text-color-active-hover);
 `,[p("a","color: var(--n-item-text-color-active-hover);"),g("extra","color: var(--n-item-text-color-active-hover);")])])]),P("child-active",[oe(null,[g("arrow","color: var(--n-arrow-color-child-active-hover);"),g("icon","color: var(--n-item-icon-color-child-active-hover);"),v("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-hover);
 `,[p("a","color: var(--n-item-text-color-child-active-hover);"),g("extra","color: var(--n-item-text-color-child-active-hover);")])])]),P("selected",[oe(null,[p("&::before","background-color: var(--n-item-color-active-hover);")])]),oe(null,to)]),g("icon",`
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
 `),g("arrow",`
 grid-area: arrow;
 font-size: 16px;
 color: var(--n-arrow-color);
 transform: rotate(180deg);
 opacity: 1;
 transition:
 color .3s var(--n-bezier),
 transform 0.2s var(--n-bezier),
 opacity 0.2s var(--n-bezier);
 `),v("menu-item-content-header",`
 grid-area: content;
 transition:
 color .3s var(--n-bezier),
 opacity .3s var(--n-bezier);
 opacity: 1;
 white-space: nowrap;
 color: var(--n-item-text-color);
 `,[p("a",`
 outline: none;
 text-decoration: none;
 transition: color .3s var(--n-bezier);
 color: var(--n-item-text-color);
 `,[p("&::before",`
 content: "";
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),g("extra",`
 font-size: .93em;
 color: var(--n-group-text-color);
 transition: color .3s var(--n-bezier);
 `)])]),v("submenu",`
 cursor: pointer;
 position: relative;
 margin-top: 6px;
 `,[v("menu-item-content",`
 height: var(--n-item-height);
 `),v("submenu-children",`
 overflow: hidden;
 padding: 0;
 `,[rt({duration:".2s"})])]),v("menu-item-group",[v("menu-item-group-title",`
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
 `)])]),v("menu-tooltip",[p("a",`
 color: inherit;
 text-decoration: none;
 `)]),v("menu-divider",`
 transition: background-color .3s var(--n-bezier);
 background-color: var(--n-divider-color);
 height: 1px;
 margin: 6px 18px;
 `)]);function oe(e,o){return[P("hover",e,o),p("&:hover",e,o)]}const _o=N({name:"MenuOptionContent",props:{collapsed:Boolean,disabled:Boolean,title:[String,Function],icon:Function,extra:[String,Function],showArrow:Boolean,childActive:Boolean,hover:Boolean,paddingLeft:Number,selected:Boolean,maxIconSize:{type:Number,required:!0},activeIconSize:{type:Number,required:!0},iconMarginRight:{type:Number,required:!0},clsPrefix:{type:String,required:!0},onClick:Function,tmNode:{type:Object,required:!0},isEllipsisPlaceholder:Boolean},setup(e){const{props:o}=Z(pe);return{menuProps:o,style:x(()=>{const{paddingLeft:t}=e;return{paddingLeft:t&&`${t}px`}}),iconStyle:x(()=>{const{maxIconSize:t,activeIconSize:n,iconMarginRight:i}=e;return{width:`${t}px`,height:`${t}px`,fontSize:`${n}px`,marginRight:`${i}px`}})}},render(){const{clsPrefix:e,tmNode:o,menuProps:{renderIcon:t,renderLabel:n,renderExtra:i,expandIcon:l}}=this,s=t?t(o.rawNode):ae(this.icon);return h("div",{onClick:m=>{var c;(c=this.onClick)===null||c===void 0||c.call(this,m)},role:"none",class:[`${e}-menu-item-content`,{[`${e}-menu-item-content--selected`]:this.selected,[`${e}-menu-item-content--collapsed`]:this.collapsed,[`${e}-menu-item-content--child-active`]:this.childActive,[`${e}-menu-item-content--disabled`]:this.disabled,[`${e}-menu-item-content--hover`]:this.hover}],style:this.style},s&&h("div",{class:`${e}-menu-item-content__icon`,style:this.iconStyle,role:"none"},[s]),h("div",{class:`${e}-menu-item-content-header`,role:"none"},this.isEllipsisPlaceholder?this.title:n?n(o.rawNode):ae(this.title),this.extra||i?h("span",{class:`${e}-menu-item-content-header__extra`}," ",i?i(o.rawNode):ae(this.extra)):null),this.showArrow?h(fo,{ariaHidden:!0,class:`${e}-menu-item-content__arrow`,clsPrefix:e},{default:()=>l?l(o.rawNode):h(Tt,null)}):null)}}),fe=8;function De(e){const o=Z(pe),{props:t,mergedCollapsedRef:n}=o,i=Z(ko,null),l=Z(Ke,null),s=x(()=>t.mode==="horizontal"),m=x(()=>s.value?t.dropdownPlacement:"tmNodes"in e?"right-start":"right"),c=x(()=>{var u;return Math.max((u=t.collapsedIconSize)!==null&&u!==void 0?u:t.iconSize,t.iconSize)}),w=x(()=>{var u;return!s.value&&e.root&&n.value&&(u=t.collapsedIconSize)!==null&&u!==void 0?u:t.iconSize}),E=x(()=>{if(s.value)return;const{collapsedWidth:u,indent:_,rootIndent:O}=t,{root:z,isGroup:$}=e,A=O===void 0?_:O;return z?n.value?u/2-c.value/2:A:l&&typeof l.paddingLeftRef.value=="number"?_/2+l.paddingLeftRef.value:i&&typeof i.paddingLeftRef.value=="number"?($?_/2:_)+i.paddingLeftRef.value:0}),k=x(()=>{const{collapsedWidth:u,indent:_,rootIndent:O}=t,{value:z}=c,{root:$}=e;return s.value||!$||!n.value?fe:(O===void 0?_:O)+z+fe-(u+z)/2});return{dropdownPlacement:m,activeIconSize:w,maxIconSize:c,paddingLeft:E,iconMarginRight:k,NMenu:o,NSubmenu:i,NMenuOptionGroup:l}}const Ve={internalKey:{type:[String,Number],required:!0},root:Boolean,isGroup:Boolean,level:{type:Number,required:!0},title:[String,Function],extra:[String,Function]},dr=N({name:"MenuDivider",setup(){const e=Z(pe),{mergedClsPrefixRef:o,isHorizontalRef:t}=e;return()=>t.value?null:h("div",{class:`${o.value}-menu-divider`})}}),zo=Object.assign(Object.assign({},Ve),{tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function}),ur=He(zo),hr=N({name:"MenuOption",props:zo,setup(e){const o=De(e),{NSubmenu:t,NMenu:n,NMenuOptionGroup:i}=o,{props:l,mergedClsPrefixRef:s,mergedCollapsedRef:m}=n,c=t?t.mergedDisabledRef:i?i.mergedDisabledRef:{value:!1},w=x(()=>c.value||e.disabled);function E(u){const{onClick:_}=e;_&&_(u)}function k(u){w.value||(n.doSelect(e.internalKey,e.tmNode.rawNode),E(u))}return{mergedClsPrefix:s,dropdownPlacement:o.dropdownPlacement,paddingLeft:o.paddingLeft,iconMarginRight:o.iconMarginRight,maxIconSize:o.maxIconSize,activeIconSize:o.activeIconSize,mergedTheme:n.mergedThemeRef,menuProps:l,dropdownEnabled:Te(()=>e.root&&m.value&&l.mode!=="horizontal"&&!w.value),selected:Te(()=>n.mergedValueRef.value===e.internalKey),mergedDisabled:w,handleClick:k}},render(){const{mergedClsPrefix:e,mergedTheme:o,tmNode:t,menuProps:{renderLabel:n,nodeProps:i}}=this,l=i?.(t.rawNode);return h("div",Object.assign({},l,{role:"menuitem",class:[`${e}-menu-item`,l?.class]}),h(Et,{theme:o.peers.Tooltip,themeOverrides:o.peerOverrides.Tooltip,trigger:"hover",placement:this.dropdownPlacement,disabled:!this.dropdownEnabled||this.title===void 0,internalExtraClass:["menu-tooltip"]},{default:()=>n?n(t.rawNode):ae(this.title),trigger:()=>h(_o,{tmNode:t,clsPrefix:e,paddingLeft:this.paddingLeft,iconMarginRight:this.iconMarginRight,maxIconSize:this.maxIconSize,activeIconSize:this.activeIconSize,selected:this.selected,title:this.title,extra:this.extra,disabled:this.mergedDisabled,icon:this.icon,onClick:this.handleClick})}))}}),So=Object.assign(Object.assign({},Ve),{tmNode:{type:Object,required:!0},tmNodes:{type:Array,required:!0}}),mr=He(So),vr=N({name:"MenuOptionGroup",props:So,setup(e){const o=De(e),{NSubmenu:t}=o,n=x(()=>t?.mergedDisabledRef.value?!0:e.tmNode.disabled);J(Ke,{paddingLeftRef:o.paddingLeft,mergedDisabledRef:n});const{mergedClsPrefixRef:i,props:l}=Z(pe);return function(){const{value:s}=i,m=o.paddingLeft.value,{nodeProps:c}=l,w=c?.(e.tmNode.rawNode);return h("div",{class:`${s}-menu-item-group`,role:"group"},h("div",Object.assign({},w,{class:[`${s}-menu-item-group-title`,w?.class],style:[w?.style||"",m!==void 0?`padding-left: ${m}px;`:""]}),ae(e.title),e.extra?h(be,null," ",ae(e.extra)):null),h("div",null,e.tmNodes.map(E=>We(E,l))))}}});function Be(e){return e.type==="divider"||e.type==="render"}function pr(e){return e.type==="divider"}function We(e,o){const{rawNode:t}=e,{show:n}=t;if(n===!1)return null;if(Be(t))return pr(t)?h(dr,Object.assign({key:e.key},t.props)):null;const{labelField:i}=o,{key:l,level:s,isGroup:m}=e,c=Object.assign(Object.assign({},t),{title:t.title||t[i],extra:t.titleExtra||t.extra,key:l,internalKey:l,level:s,root:s===0,isGroup:m});return e.children?e.isGroup?h(vr,$e(c,mr,{tmNode:e,tmNodes:e.children,key:l})):h(Oe,$e(c,fr,{key:l,rawNodes:t[o.childrenField],tmNodes:e.children,tmNode:e})):h(hr,$e(c,ur,{key:l,tmNode:e}))}const Io=Object.assign(Object.assign({},Ve),{rawNodes:{type:Array,default:()=>[]},tmNodes:{type:Array,default:()=>[]},tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function,domId:String,virtualChildActive:{type:Boolean,default:void 0},isEllipsisPlaceholder:Boolean}),fr=He(Io),Oe=N({name:"Submenu",props:Io,setup(e){const o=De(e),{NMenu:t,NSubmenu:n}=o,{props:i,mergedCollapsedRef:l,mergedThemeRef:s}=t,m=x(()=>{const{disabled:u}=e;return n?.mergedDisabledRef.value||i.disabled?!0:u}),c=K(!1);J(ko,{paddingLeftRef:o.paddingLeft,mergedDisabledRef:m}),J(Ke,null);function w(){const{onClick:u}=e;u&&u()}function E(){m.value||(l.value||t.toggleExpand(e.internalKey),w())}function k(u){c.value=u}return{menuProps:i,mergedTheme:s,doSelect:t.doSelect,inverted:t.invertedRef,isHorizontal:t.isHorizontalRef,mergedClsPrefix:t.mergedClsPrefixRef,maxIconSize:o.maxIconSize,activeIconSize:o.activeIconSize,iconMarginRight:o.iconMarginRight,dropdownPlacement:o.dropdownPlacement,dropdownShow:c,paddingLeft:o.paddingLeft,mergedDisabled:m,mergedValue:t.mergedValueRef,childActive:Te(()=>{var u;return(u=e.virtualChildActive)!==null&&u!==void 0?u:t.activePathRef.value.includes(e.internalKey)}),collapsed:x(()=>i.mode==="horizontal"?!1:l.value?!0:!t.mergedExpandedKeysRef.value.includes(e.internalKey)),dropdownEnabled:x(()=>!m.value&&(i.mode==="horizontal"||l.value)),handlePopoverShowChange:k,handleClick:E}},render(){var e;const{mergedClsPrefix:o,menuProps:{renderIcon:t,renderLabel:n}}=this,i=()=>{const{isHorizontal:s,paddingLeft:m,collapsed:c,mergedDisabled:w,maxIconSize:E,activeIconSize:k,title:u,childActive:_,icon:O,handleClick:z,menuProps:{nodeProps:$},dropdownShow:A,iconMarginRight:G,tmNode:R,mergedClsPrefix:b,isEllipsisPlaceholder:M,extra:d}=this,f=$?.(R.rawNode);return h("div",Object.assign({},f,{class:[`${b}-menu-item`,f?.class],role:"menuitem"}),h(_o,{tmNode:R,paddingLeft:m,collapsed:c,disabled:w,iconMarginRight:G,maxIconSize:E,activeIconSize:k,title:u,extra:d,showArrow:!s,childActive:_,clsPrefix:b,icon:O,hover:A,onClick:z,isEllipsisPlaceholder:M}))},l=()=>h(nt,null,{default:()=>{const{tmNodes:s,collapsed:m}=this;return m?null:h("div",{class:`${o}-submenu-children`,role:"menu"},s.map(c=>We(c,this.menuProps)))}});return this.root?h(wo,Object.assign({size:"large",trigger:"hover"},(e=this.menuProps)===null||e===void 0?void 0:e.dropdownProps,{themeOverrides:this.mergedTheme.peerOverrides.Dropdown,theme:this.mergedTheme.peers.Dropdown,builtinThemeOverrides:{fontSizeLarge:"14px",optionIconSizeLarge:"18px"},value:this.mergedValue,disabled:!this.dropdownEnabled,placement:this.dropdownPlacement,keyField:this.menuProps.keyField,labelField:this.menuProps.labelField,childrenField:this.menuProps.childrenField,onUpdateShow:this.handlePopoverShowChange,options:this.rawNodes,onSelect:this.doSelect,inverted:this.inverted,renderIcon:t,renderLabel:n}),{default:()=>h("div",{class:`${o}-submenu`,role:"menu","aria-expanded":!this.collapsed,id:this.domId},i(),this.isHorizontal?null:l())}):h("div",{class:`${o}-submenu`,role:"menu","aria-expanded":!this.collapsed,id:this.domId},i(),l())}}),gr=Object.assign(Object.assign({},Q.props),{options:{type:Array,default:()=>[]},collapsed:{type:Boolean,default:void 0},collapsedWidth:{type:Number,default:48},iconSize:{type:Number,default:20},collapsedIconSize:{type:Number,default:24},rootIndent:Number,indent:{type:Number,default:32},labelField:{type:String,default:"label"},keyField:{type:String,default:"key"},childrenField:{type:String,default:"children"},disabledField:{type:String,default:"disabled"},defaultExpandAll:Boolean,defaultExpandedKeys:Array,expandedKeys:Array,value:[String,Number],defaultValue:{type:[String,Number],default:null},mode:{type:String,default:"vertical"},watchProps:{type:Array,default:void 0},disabled:Boolean,show:{type:Boolean,default:!0},inverted:Boolean,"onUpdate:expandedKeys":[Function,Array],onUpdateExpandedKeys:[Function,Array],onUpdateValue:[Function,Array],"onUpdate:value":[Function,Array],expandIcon:Function,renderIcon:Function,renderLabel:Function,renderExtra:Function,dropdownProps:Object,accordion:Boolean,nodeProps:Function,dropdownPlacement:{type:String,default:"bottom"},responsive:Boolean,items:Array,onOpenNamesChange:[Function,Array],onSelect:[Function,Array],onExpandedNamesChange:[Function,Array],expandedNames:Array,defaultExpandedNames:Array}),br=N({name:"Menu",inheritAttrs:!1,props:gr,setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:t}=ce(e),n=Q("Menu","-menu",cr,Mt,e,o),i=Z(xo,null),l=x(()=>{var y;const{collapsed:B}=e;if(B!==void 0)return B;if(i){const{collapseModeRef:r,collapsedRef:I}=i;if(r.value==="width")return(y=I.value)!==null&&y!==void 0?y:!1}return!1}),s=x(()=>{const{keyField:y,childrenField:B,disabledField:r}=e;return Me(e.items||e.options,{getIgnored(I){return Be(I)},getChildren(I){return I[B]},getDisabled(I){return I[r]},getKey(I){var U;return(U=I[y])!==null&&U!==void 0?U:I.name}})}),m=x(()=>new Set(s.value.treeNodes.map(y=>y.key))),{watchProps:c}=e,w=K(null);c?.includes("defaultValue")?Pe(()=>{w.value=e.defaultValue}):w.value=e.defaultValue;const E=se(e,"value"),k=he(E,w),u=K([]),_=()=>{u.value=e.defaultExpandAll?s.value.getNonLeafKeys():e.defaultExpandedNames||e.defaultExpandedKeys||s.value.getPath(k.value,{includeSelf:!1}).keyPath};c?.includes("defaultExpandedKeys")?Pe(_):_();const O=Rt(e,["expandedNames","expandedKeys"]),z=he(O,u),$=x(()=>s.value.treeNodes),A=x(()=>s.value.getPath(k.value).keyPath);J(pe,{props:e,mergedCollapsedRef:l,mergedThemeRef:n,mergedValueRef:k,mergedExpandedKeysRef:z,activePathRef:A,mergedClsPrefixRef:o,isHorizontalRef:x(()=>e.mode==="horizontal"),invertedRef:se(e,"inverted"),doSelect:G,toggleExpand:b});function G(y,B){const{"onUpdate:value":r,onUpdateValue:I,onSelect:U}=e;I&&Y(I,y,B),r&&Y(r,y,B),U&&Y(U,y,B),w.value=y}function R(y){const{"onUpdate:expandedKeys":B,onUpdateExpandedKeys:r,onExpandedNamesChange:I,onOpenNamesChange:U}=e;B&&Y(B,y),r&&Y(r,y),I&&Y(I,y),U&&Y(U,y),u.value=y}function b(y){const B=Array.from(z.value),r=B.findIndex(I=>I===y);if(~r)B.splice(r,1);else{if(e.accordion&&m.value.has(y)){const I=B.findIndex(U=>m.value.has(U));I>-1&&B.splice(I,1)}B.push(y)}R(B)}const M=y=>{const B=s.value.getPath(y??k.value,{includeSelf:!1}).keyPath;if(!B.length)return;const r=Array.from(z.value),I=new Set([...r,...B]);e.accordion&&m.value.forEach(U=>{I.has(U)&&!B.includes(U)&&I.delete(U)}),R(Array.from(I))},d=x(()=>{const{inverted:y}=e,{common:{cubicBezierEaseInOut:B},self:r}=n.value,{borderRadius:I,borderColorHorizontal:U,fontSize:Se,itemHeight:Ie,dividerColor:Re}=r,a={"--n-divider-color":Re,"--n-bezier":B,"--n-font-size":Se,"--n-border-color-horizontal":U,"--n-border-radius":I,"--n-item-height":Ie};return y?(a["--n-group-text-color"]=r.groupTextColorInverted,a["--n-color"]=r.colorInverted,a["--n-item-text-color"]=r.itemTextColorInverted,a["--n-item-text-color-hover"]=r.itemTextColorHoverInverted,a["--n-item-text-color-active"]=r.itemTextColorActiveInverted,a["--n-item-text-color-child-active"]=r.itemTextColorChildActiveInverted,a["--n-item-text-color-child-active-hover"]=r.itemTextColorChildActiveInverted,a["--n-item-text-color-active-hover"]=r.itemTextColorActiveHoverInverted,a["--n-item-icon-color"]=r.itemIconColorInverted,a["--n-item-icon-color-hover"]=r.itemIconColorHoverInverted,a["--n-item-icon-color-active"]=r.itemIconColorActiveInverted,a["--n-item-icon-color-active-hover"]=r.itemIconColorActiveHoverInverted,a["--n-item-icon-color-child-active"]=r.itemIconColorChildActiveInverted,a["--n-item-icon-color-child-active-hover"]=r.itemIconColorChildActiveHoverInverted,a["--n-item-icon-color-collapsed"]=r.itemIconColorCollapsedInverted,a["--n-item-text-color-horizontal"]=r.itemTextColorHorizontalInverted,a["--n-item-text-color-hover-horizontal"]=r.itemTextColorHoverHorizontalInverted,a["--n-item-text-color-active-horizontal"]=r.itemTextColorActiveHorizontalInverted,a["--n-item-text-color-child-active-horizontal"]=r.itemTextColorChildActiveHorizontalInverted,a["--n-item-text-color-child-active-hover-horizontal"]=r.itemTextColorChildActiveHoverHorizontalInverted,a["--n-item-text-color-active-hover-horizontal"]=r.itemTextColorActiveHoverHorizontalInverted,a["--n-item-icon-color-horizontal"]=r.itemIconColorHorizontalInverted,a["--n-item-icon-color-hover-horizontal"]=r.itemIconColorHoverHorizontalInverted,a["--n-item-icon-color-active-horizontal"]=r.itemIconColorActiveHorizontalInverted,a["--n-item-icon-color-active-hover-horizontal"]=r.itemIconColorActiveHoverHorizontalInverted,a["--n-item-icon-color-child-active-horizontal"]=r.itemIconColorChildActiveHorizontalInverted,a["--n-item-icon-color-child-active-hover-horizontal"]=r.itemIconColorChildActiveHoverHorizontalInverted,a["--n-arrow-color"]=r.arrowColorInverted,a["--n-arrow-color-hover"]=r.arrowColorHoverInverted,a["--n-arrow-color-active"]=r.arrowColorActiveInverted,a["--n-arrow-color-active-hover"]=r.arrowColorActiveHoverInverted,a["--n-arrow-color-child-active"]=r.arrowColorChildActiveInverted,a["--n-arrow-color-child-active-hover"]=r.arrowColorChildActiveHoverInverted,a["--n-item-color-hover"]=r.itemColorHoverInverted,a["--n-item-color-active"]=r.itemColorActiveInverted,a["--n-item-color-active-hover"]=r.itemColorActiveHoverInverted,a["--n-item-color-active-collapsed"]=r.itemColorActiveCollapsedInverted):(a["--n-group-text-color"]=r.groupTextColor,a["--n-color"]=r.color,a["--n-item-text-color"]=r.itemTextColor,a["--n-item-text-color-hover"]=r.itemTextColorHover,a["--n-item-text-color-active"]=r.itemTextColorActive,a["--n-item-text-color-child-active"]=r.itemTextColorChildActive,a["--n-item-text-color-child-active-hover"]=r.itemTextColorChildActiveHover,a["--n-item-text-color-active-hover"]=r.itemTextColorActiveHover,a["--n-item-icon-color"]=r.itemIconColor,a["--n-item-icon-color-hover"]=r.itemIconColorHover,a["--n-item-icon-color-active"]=r.itemIconColorActive,a["--n-item-icon-color-active-hover"]=r.itemIconColorActiveHover,a["--n-item-icon-color-child-active"]=r.itemIconColorChildActive,a["--n-item-icon-color-child-active-hover"]=r.itemIconColorChildActiveHover,a["--n-item-icon-color-collapsed"]=r.itemIconColorCollapsed,a["--n-item-text-color-horizontal"]=r.itemTextColorHorizontal,a["--n-item-text-color-hover-horizontal"]=r.itemTextColorHoverHorizontal,a["--n-item-text-color-active-horizontal"]=r.itemTextColorActiveHorizontal,a["--n-item-text-color-child-active-horizontal"]=r.itemTextColorChildActiveHorizontal,a["--n-item-text-color-child-active-hover-horizontal"]=r.itemTextColorChildActiveHoverHorizontal,a["--n-item-text-color-active-hover-horizontal"]=r.itemTextColorActiveHoverHorizontal,a["--n-item-icon-color-horizontal"]=r.itemIconColorHorizontal,a["--n-item-icon-color-hover-horizontal"]=r.itemIconColorHoverHorizontal,a["--n-item-icon-color-active-horizontal"]=r.itemIconColorActiveHorizontal,a["--n-item-icon-color-active-hover-horizontal"]=r.itemIconColorActiveHoverHorizontal,a["--n-item-icon-color-child-active-horizontal"]=r.itemIconColorChildActiveHorizontal,a["--n-item-icon-color-child-active-hover-horizontal"]=r.itemIconColorChildActiveHoverHorizontal,a["--n-arrow-color"]=r.arrowColor,a["--n-arrow-color-hover"]=r.arrowColorHover,a["--n-arrow-color-active"]=r.arrowColorActive,a["--n-arrow-color-active-hover"]=r.arrowColorActiveHover,a["--n-arrow-color-child-active"]=r.arrowColorChildActive,a["--n-arrow-color-child-active-hover"]=r.arrowColorChildActiveHover,a["--n-item-color-hover"]=r.itemColorHover,a["--n-item-color-active"]=r.itemColorActive,a["--n-item-color-active-hover"]=r.itemColorActiveHover,a["--n-item-color-active-collapsed"]=r.itemColorActiveCollapsed),a}),f=t?me("menu",x(()=>e.inverted?"a":"b"),d,e):void 0,F=lt(),S=K(null),D=K(null);let H=!0;const X=()=>{var y;H?H=!1:(y=S.value)===null||y===void 0||y.sync({showAllItemsBeforeCalculate:!0})};function V(){return document.getElementById(F)}const re=K(-1);function xe(y){re.value=e.options.length-y}function ye(y){y||(re.value=-1)}const Ce=x(()=>{const y=re.value;return{children:y===-1?[]:e.options.slice(y)}}),ke=x(()=>{const{childrenField:y,disabledField:B,keyField:r}=e;return Me([Ce.value],{getIgnored(I){return Be(I)},getChildren(I){return I[y]},getDisabled(I){return I[B]},getKey(I){var U;return(U=I[r])!==null&&U!==void 0?U:I.name}})}),_e=x(()=>Me([{}]).treeNodes[0]);function ze(){var y;if(re.value===-1)return h(Oe,{root:!0,level:0,key:"__ellpisisGroupPlaceholder__",internalKey:"__ellpisisGroupPlaceholder__",title:"···",tmNode:_e.value,domId:F,isEllipsisPlaceholder:!0});const B=ke.value.treeNodes[0],r=A.value,I=!!(!((y=B.children)===null||y===void 0)&&y.some(U=>r.includes(U.key)));return h(Oe,{level:0,root:!0,key:"__ellpisisGroup__",internalKey:"__ellpisisGroup__",title:"···",virtualChildActive:I,tmNode:B,domId:F,rawNodes:B.rawNode.children||[],tmNodes:B.children||[],isEllipsisPlaceholder:!0})}return{mergedClsPrefix:o,controlledExpandedKeys:O,uncontrolledExpanededKeys:u,mergedExpandedKeys:z,uncontrolledValue:w,mergedValue:k,activePath:A,tmNodes:$,mergedTheme:n,mergedCollapsed:l,cssVars:t?void 0:d,themeClass:f?.themeClass,overflowRef:S,counterRef:D,updateCounter:()=>{},onResize:X,onUpdateOverflow:ye,onUpdateCount:xe,renderCounter:ze,getCounter:V,onRender:f?.onRender,showOption:M,deriveResponsiveState:X}},render(){const{mergedClsPrefix:e,mode:o,themeClass:t,onRender:n}=this;n?.();const i=()=>this.tmNodes.map(c=>We(c,this.$props)),s=o==="horizontal"&&this.responsive,m=()=>h("div",uo(this.$attrs,{role:o==="horizontal"?"menubar":"menu",class:[`${e}-menu`,t,`${e}-menu--${o}`,s&&`${e}-menu--responsive`,this.mergedCollapsed&&`${e}-menu--collapsed`],style:this.cssVars}),s?h(Pt,{ref:"overflowRef",onUpdateOverflow:this.onUpdateOverflow,getCounter:this.getCounter,onUpdateCount:this.onUpdateCount,updateCounter:this.updateCounter,style:{width:"100%",display:"flex",overflow:"hidden"}},{default:i,counter:this.renderCounter}):i());return s?h(it,{onResize:this.onResize},{default:m}):m()}}),wr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},xr=N({name:"CalendarOutline",render:function(o,t){return j(),W("svg",wr,t[0]||(t[0]=[Ne('<rect fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" x="48" y="80" width="416" height="384" rx="48"></rect><circle cx="296" cy="232" r="24" fill="currentColor"></circle><circle cx="376" cy="232" r="24" fill="currentColor"></circle><circle cx="296" cy="312" r="24" fill="currentColor"></circle><circle cx="376" cy="312" r="24" fill="currentColor"></circle><circle cx="136" cy="312" r="24" fill="currentColor"></circle><circle cx="216" cy="312" r="24" fill="currentColor"></circle><circle cx="136" cy="392" r="24" fill="currentColor"></circle><circle cx="216" cy="392" r="24" fill="currentColor"></circle><circle cx="296" cy="392" r="24" fill="currentColor"></circle><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" stroke-linecap="round" d="M128 48v32"></path><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" stroke-linecap="round" d="M384 48v32"></path><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" d="M464 160H48"></path>',13)]))}}),yr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Ye=N({name:"CheckmarkOutline",render:function(o,t){return j(),W("svg",yr,t[0]||(t[0]=[C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M416 128L192 384l-96-96"},null,-1)]))}}),Cr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},kr=N({name:"ContrastOutline",render:function(o,t){return j(),W("svg",Cr,t[0]||(t[0]=[C("circle",{cx:"256",cy:"256",r:"208",fill:"none",stroke:"currentColor","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("path",{d:"M256 464c-114.88 0-208-93.12-208-208S141.12 48 256 48z",fill:"currentColor"},null,-1)]))}}),_r={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},no=N({name:"FolderOpenOutline",render:function(o,t){return j(),W("svg",_r,t[0]||(t[0]=[C("path",{d:"M64 192v-72a40 40 0 0 1 40-40h75.89a40 40 0 0 1 22.19 6.72l27.84 18.56a40 40 0 0 0 22.19 6.72H408a40 40 0 0 1 40 40v40",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("path",{d:"M479.9 226.55L463.68 392a40 40 0 0 1-39.93 40H88.25a40 40 0 0 1-39.93-40L32.1 226.55A32 32 0 0 1 64 192h384.1a32 32 0 0 1 31.8 34.55z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),zr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Sr=N({name:"GridOutline",render:function(o,t){return j(),W("svg",zr,t[0]||(t[0]=[C("rect",{x:"48",y:"48",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("rect",{x:"288",y:"48",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("rect",{x:"48",y:"288",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("rect",{x:"288",y:"288",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),Ir={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Rr=N({name:"LayersOutline",render:function(o,t){return j(),W("svg",Ir,t[0]||(t[0]=[C("path",{d:"M434.8 137.65l-149.36-68.1c-16.19-7.4-42.69-7.4-58.88 0L77.3 137.65c-17.6 8-17.6 21.09 0 29.09l148 67.5c16.89 7.7 44.69 7.7 61.58 0l148-67.5c17.52-8 17.52-21.1-.08-29.09z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("path",{d:"M160 308.52l-82.7 37.11c-17.6 8-17.6 21.1 0 29.1l148 67.5c16.89 7.69 44.69 7.69 61.58 0l148-67.5c17.6-8 17.6-21.1 0-29.1l-79.94-38.47",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("path",{d:"M160 204.48l-82.8 37.16c-17.6 8-17.6 21.1 0 29.1l148 67.49c16.89 7.7 44.69 7.7 61.58 0l148-67.49c17.7-8 17.7-21.1.1-29.1L352 204.48",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),$r={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Mr=N({name:"LibraryOutline",render:function(o,t){return j(),W("svg",$r,t[0]||(t[0]=[Ne('<rect x="32" y="96" width="64" height="368" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 224h128"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 400h128"></path><rect x="112" y="160" width="128" height="304" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><rect x="256" y="48" width="96" height="416" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><path d="M422.46 96.11l-40.4 4.25c-11.12 1.17-19.18 11.57-17.93 23.1l34.92 321.59c1.26 11.53 11.37 20 22.49 18.84l40.4-4.25c11.12-1.17 19.18-11.57 17.93-23.1L445 115c-1.31-11.58-11.42-20.06-22.54-18.89z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></path>',6)]))}}),Er={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Pr=N({name:"LogOutOutline",render:function(o,t){return j(),W("svg",Er,t[0]||(t[0]=[C("path",{d:"M304 336v40a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V136a40 40 0 0 1 40-40h152c22.09 0 48 17.91 48 40v40",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M368 336l80-80l-80-80"},null,-1),C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M176 256h256"},null,-1)]))}}),Tr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Br=N({name:"MenuOutline",render:function(o,t){return j(),W("svg",Tr,t[0]||(t[0]=[C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 160h352"},null,-1),C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 256h352"},null,-1),C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 352h352"},null,-1)]))}}),Or={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Ro=N({name:"MoonOutline",render:function(o,t){return j(),W("svg",Or,t[0]||(t[0]=[C("path",{d:"M160 136c0-30.62 4.51-61.61 16-88C99.57 81.27 48 159.32 48 248c0 119.29 96.71 216 216 216c88.68 0 166.73-51.57 200-128c-26.39 11.49-57.38 16-88 16c-119.29 0-216-96.71-216-216z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),Nr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Ar=N({name:"PersonCircleOutline",render:function(o,t){return j(),W("svg",Nr,t[0]||(t[0]=[C("path",{d:"M258.9 48C141.92 46.42 46.42 141.92 48 258.9c1.56 112.19 92.91 203.54 205.1 205.1c117 1.6 212.48-93.9 210.88-210.88C462.44 140.91 371.09 49.56 258.9 48zm126.42 327.25a4 4 0 0 1-6.14-.32a124.27 124.27 0 0 0-32.35-29.59C321.37 329 289.11 320 256 320s-65.37 9-90.83 25.34a124.24 124.24 0 0 0-32.35 29.58a4 4 0 0 1-6.14.32A175.32 175.32 0 0 1 80 259c-1.63-97.31 78.22-178.76 175.57-179S432 158.81 432 256a175.32 175.32 0 0 1-46.68 119.25z",fill:"currentColor"},null,-1),C("path",{d:"M256 144c-19.72 0-37.55 7.39-50.22 20.82s-19 32-17.57 51.93C191.11 256 221.52 288 256 288s64.83-32 67.79-71.24c1.48-19.74-4.8-38.14-17.68-51.82C293.39 151.44 275.59 144 256 144z",fill:"currentColor"},null,-1)]))}}),Hr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},io=N({name:"ServerOutline",render:function(o,t){return j(),W("svg",Hr,t[0]||(t[0]=[C("ellipse",{cx:"256",cy:"128",rx:"192",ry:"80",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32"},null,-1),C("path",{d:"M448 214c0 44.18-86 80-192 80S64 258.18 64 214",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32"},null,-1),C("path",{d:"M448 300c0 44.18-86 80-192 80S64 344.18 64 300",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32"},null,-1),C("path",{d:"M64 127.24v257.52C64 428.52 150 464 256 464s192-35.48 192-79.24V127.24",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32"},null,-1)]))}}),Fr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},$o=N({name:"SettingsOutline",render:function(o,t){return j(),W("svg",Fr,t[0]||(t[0]=[C("path",{d:"M262.29 192.31a64 64 0 1 0 57.4 57.4a64.13 64.13 0 0 0-57.4-57.4zM416.39 256a154.34 154.34 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.48 164.48 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22a155.3 155.3 0 0 1-21.46-12.57a16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.48 164.48 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22a155.3 155.3 0 0 1 21.46 12.57a16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0-6.05 14.08c.33 4.14.55 8.3.55 12.47z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),Lr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Mo=N({name:"SunnyOutline",render:function(o,t){return j(),W("svg",Lr,t[0]||(t[0]=[Ne('<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 48v48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 416v48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 108.92l-33.94 33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 369.14l-33.94 33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M464 256h-48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M96 256H48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 403.08l-33.94-33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 142.86l-33.94-33.94"></path><circle cx="256" cy="256" r="80" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"></circle>',9)]))}}),te=e=>()=>h(ge,null,{default:()=>h(e)});function jr(e){const o=(l,s,m)=>({label:()=>h(Oo,{to:{name:s},onClick:e.onNavigate},{default:()=>l}),key:s,...m?{icon:te(m)}:{}}),t=new Set(at(e.can)),i=[{key:"dashboard",build:()=>o("工作台","dashboard",Sr)},{key:"memos",build:()=>o("备忘录","memos",gt)},{key:"warehouse",build:()=>({label:"二级库",key:"warehouse-group",icon:te(eo),children:[o("库存查询","stock"),o("物资档案","stock-materials"),o("操作记录","operations"),...e.can("warehouse:write")?[o("入库","inbound"),o("出库","outbound")]:[]]})},{key:"warehouse_lite",build:()=>o("二级库","warehouse-lite",eo)},{key:"huaxing_inventory",build:()=>o("华星总库存","hua-xing-stock",Rr)},{key:"procurement",build:()=>({label:"申购管理",key:"procurement-group",icon:te(bt),children:[o("申购计划","purchase-materials"),o("周期性计划","purchase-plan-templates"),o("未编码物资","uncoded-materials"),o("物料编码库","material-code-library"),o("申购记录","purchase-records")]})},{key:"hazards",build:()=>({label:"隐患管理",key:"hazard-group",icon:te(wt),children:[o("隐患管理","hazard-records"),o("隐患类型","hazard-types"),o("责任单位","hazard-units")]})},{key:"ledger",build:()=>({label:"台账管理",key:"ledger-group",icon:te(Mr),children:[o("台账总览","ledger-items"),o("标签管理","ledger-tags")]})},{key:"work",build:()=>({label:"工作管理",key:"work-group",icon:te(xr),children:[o("工作总览","work-overview"),o("任务视图","work-tasks"),o("人员视图","work-workers")]})}].filter(l=>t.has(l.key)).map(l=>l.build());return e.can("system:admin")&&i.push({label:"系统管理",key:"settings-group",icon:te($o),children:[o("用户管理","users"),o("项目管理","projects"),o("附件管理","attachments"),o("高级设置","advanced-settings"),o("分享链接","share-links"),o("关于","about")]}),i}const Ur={class:"account-summary"},Kr={class:"account-name"},Dr={class:"account-meta"},Vr=N({__name:"AccountSettingsModal",props:{show:{type:Boolean}},emits:["update:show"],setup(e,{emit:o}){const t=e,n=o,i=Fe(),l=go(),s=kt(),m=x({get:()=>t.show,set:R=>n("update:show",R)}),c=K(null),w=K(!1),E=K(!1),k=No({current_password:"",new_password:"",confirm_password:""}),u=x(()=>i.user),_=x(()=>{const R=c.value?.api_token;return R?dt(ut(),R,l.currentProjectId):""}),O=x(()=>c.value?.api_token?c.value.api_token:w.value?"正在加载…":c.value?"（旧版令牌无法回显，请联系管理员重新生成）":"（暂不可用）");function z(){k.current_password="",k.new_password="",k.confirm_password=""}async function $(){w.value=!0;try{c.value=await Ze.myApiToken()}catch(R){s.error(R instanceof Error?R.message:"MCP 令牌加载失败")}finally{w.value=!1}}async function A(R,b){if(R)try{await navigator.clipboard.writeText(R),s.success(`${b}已复制`)}catch{s.error(`复制失败，请手动选择${b}`)}}async function G(){if(!k.new_password||k.new_password.length<6){s.error("新密码至少 6 位");return}if(k.new_password!==k.confirm_password){s.error("两次输入的新密码不一致");return}E.value=!0;try{await Ze.changeMyPassword({...k.current_password?{current_password:k.current_password}:{},new_password:k.new_password}),z(),s.success("密码已修改，下次登录请使用新密码"),i.refresh().catch(()=>{})}catch(R){s.error(R instanceof Error?R.message:"密码修改失败")}finally{E.value=!1}}return ho(()=>t.show,R=>{if(!R){c.value=null,z();return}z(),$()}),(R,b)=>{const M=zt,d=St,f=ct,F=xt,S=yt,D=_t,H=Ct,X=st;return j(),ie(X,{show:m.value,"onUpdate:show":b[6]||(b[6]=V=>m.value=V),preset:"card",title:"用户设置",style:{width:"min(540px, calc(100vw - 32px))"}},{footer:L(()=>[T(H,{justify:"end"},{default:L(()=>[T(f,{onClick:b[5]||(b[5]=V=>m.value=!1)},{default:L(()=>[...b[12]||(b[12]=[ne("关闭",-1)])]),_:1}),T(f,{type:"primary",loading:E.value,onClick:G},{default:L(()=>[...b[13]||(b[13]=[ne("修改密码",-1)])]),_:1},8,["loading"])]),_:1})]),default:L(()=>[T(D,{"label-placement":"top",size:"small","show-feedback":!1},{default:L(()=>[T(M,{label:"账号"},{default:L(()=>[C("div",Ur,[C("span",Kr,le(u.value?.display_name||u.value?.username||"—"),1),C("span",Dr,[ne(" @"+le(u.value?.username||"—")+" ",1),u.value?.department_name?(j(),W(be,{key:0},[ne(" · "+le(u.value.department_name),1)],64)):ee("",!0)]),b[7]||(b[7]=C("span",{class:"account-hint"},"个人资料由管理员维护，这里只能修改密码。",-1))])]),_:1}),T(M,{label:"MCP 地址"},{default:L(()=>[T(F,null,{default:L(()=>[T(d,{value:_.value||"（令牌加载后生成）",readonly:""},null,8,["value"]),T(f,{disabled:!_.value,onClick:b[0]||(b[0]=V=>A(_.value,"MCP 地址"))},{default:L(()=>[...b[8]||(b[8]=[ne("复制地址",-1)])]),_:1},8,["disabled"])]),_:1})]),_:1}),T(M,{label:"MCP 令牌"},{default:L(()=>[T(F,null,{default:L(()=>[T(d,{value:O.value,readonly:""},null,8,["value"]),T(f,{disabled:!c.value?.api_token,onClick:b[1]||(b[1]=V=>A(c.value?.api_token??"","MCP 令牌"))},{default:L(()=>[...b[9]||(b[9]=[ne(" 复制令牌 ",-1)])]),_:1},8,["disabled"])]),_:1})]),_:1}),b[10]||(b[10]=C("p",{class:"token-hint"},"MCP 地址已包含令牌，请勿公开分享；令牌仅供本人使用。",-1)),T(S),b[11]||(b[11]=C("div",{class:"section-title"},"修改密码",-1)),T(M,{label:"当前密码"},{default:L(()=>[T(d,{value:k.current_password,"onUpdate:value":b[2]||(b[2]=V=>k.current_password=V),type:"password","show-password-on":"click",placeholder:"未设置过密码的账号可留空"},null,8,["value"])]),_:1}),T(M,{label:"新密码"},{default:L(()=>[T(d,{value:k.new_password,"onUpdate:value":b[3]||(b[3]=V=>k.new_password=V),type:"password","show-password-on":"click",placeholder:"至少 6 位"},null,8,["value"])]),_:1}),T(M,{label:"确认新密码"},{default:L(()=>[T(d,{value:k.confirm_password,"onUpdate:value":b[4]||(b[4]=V=>k.confirm_password=V),type:"password","show-password-on":"click",placeholder:"再次输入新密码"},null,8,["value"])]),_:1})]),_:1})]),_:1},8,["show"])}}}),Wr=Le(Vr,[["__scopeId","data-v-c7485973"]]),Yr={auto:"自动",light:"浅色",dark:"深色"},Xr={auto:kr,light:Mo,dark:Ro},Gr="外观",qr="theme-menu";function Jr(e){return bo.includes(e)}function Qr(e,o,t){return[{label:Gr,key:qr,icon:t(o?Ro:Mo),children:bo.map(n=>({key:n,label:Yr[n],icon:t(n===e?Ye:Xr[n])}))}]}const Zr="backend-menu",en="线路：",Xe="backend:";function Eo(e){return e.startsWith(Xe)}function on(e){if(!Eo(e))return null;const o=Number(e.slice(Xe.length));return Number.isInteger(o)&&o>=0?o:null}function lo(e,o){try{const t=new URL(e,o),n=t.origin===o?"本站":t.host,i=t.pathname.replace(/\/+$/,"")||"/";return i==="/api/v1"?n:`${n}${i}`}catch{return e}}function tn(e,o,t,n=window.location.origin){if(e.length<2)return[];const i=e[o]??e[0];return[{label:`${en}${lo(i,n)}`,key:Zr,icon:t(io),children:e.map((l,s)=>({key:`${Xe}${s}`,label:lo(l,n),icon:t(s===o?Ye:io)}))}]}const rn="project-menu",nn="项目：",Ge="project:",ln="project:none",an="暂无可用项目";function Po(e){return e.startsWith(Ge)}function sn(e){if(!Po(e))return null;const o=Number(e.slice(Ge.length));return Number.isInteger(o)&&o>0?o:null}function ao(e){return e.name?.trim()||"未命名项目"}function cn(e,o,t){const n=e.find(i=>i.id===o)??null;return[{label:`${nn}${n?ao(n):"未选择"}`,key:rn,icon:t(no),children:e.length?e.map(i=>({key:`${Ge}${i.id}`,label:ao(i),icon:t(i.id===o?Ye:no)})):[{key:ln,label:an,disabled:!0}]}]}const dn={class:"user-menu-icon","aria-hidden":"true"},un={key:0,class:"user-summary"},hn={class:"user-name"},mn={class:"user-role"},vn={key:1,class:"user-menu-caret","aria-hidden":"true"},pn=N({__name:"UserMenu",props:{collapsed:{type:Boolean},zIndex:{}},setup(e){const o=Ao(),t=Fe(),n=go(),i=ht(),l=K(!1),s=u=>()=>h(ge,null,{default:()=>h(u)}),m=x(()=>t.user?.display_name||t.user?.username||"未登录"),c=x(()=>{const u=t.user?.permissions??[];if(u.length===0)return"未分配权限";if(u.includes("system:admin"))return"系统管理";const _=[["warehouse","二级库"],["lite","二级库"],["purchase","申购"],["huaxing","华星"],["codes","编码库"],["ledger","台账"],["hazard","隐患"],["work","工单"]],O=_.filter(([$])=>u.includes(`${$}:write`));return O.length>0?O.map(([,$])=>`${$}读写`).join(" / "):_.filter(([$])=>u.includes(`${$}:read`)).length>0?"只读":"未分配权限"}),w=x(()=>[...Qr(i.mode,i.isDark,s),...cn(n.enabledProjects,n.currentProject?.id??null,s),...tn(pt(),vt(),s),{type:"divider",key:"account-divider"},{label:"用户设置",key:"account-settings",icon:s($o)},{label:"退出登录",key:"logout",icon:s(Pr)}]);function E(u){if(u==="account-settings"){l.value=!0;return}if(u==="logout"){k();return}if(Jr(u)){i.setMode(u);return}if(Po(u)){const _=sn(u);_!==null&&n.select(_);return}if(Eo(u)){const _=on(u);_!==null&&mt(_)&&location.reload()}}function k(){t.logout(),n.clear(),o.push({name:"login"})}return(u,_)=>{const O=wo;return j(),W(be,null,[T(O,{options:w.value,"z-index":e.zIndex,placement:"top-start",trigger:"click",onSelect:E},{default:L(()=>[C("button",{type:"button",class:mo(["user-menu-trigger",{compact:e.collapsed}]),"aria-label":"打开用户菜单"},[C("span",dn,[T(q(ge),{size:18},{default:L(()=>[T(q(Ar))]),_:1})]),e.collapsed?ee("",!0):(j(),W("span",un,[C("span",hn,le(m.value),1),C("span",mn,le(c.value),1)])),e.collapsed?ee("",!0):(j(),W("span",vn))],2)]),_:1},8,["options","z-index"]),T(Wr,{show:l.value,"onUpdate:show":_[0]||(_[0]=z=>l.value=z)},null,8,["show"])],64)}}}),so=Le(pn,[["__scopeId","data-v-2272b70c"]]),fn=["src"],gn={key:0},bn={class:"sider-user"},wn={class:"mobile-title"},xn={class:"drawer-brand"},yn=["src"],Cn={class:"drawer-user"},kn=N({__name:"AppLayout",setup(e){const o=Fo(),t=Fe(),n=K(!1),i=ft("(max-width: 768px)"),l=K(!1),s=()=>{l.value=!1},m=x(()=>jr({can:w=>t.can(w),onNavigate:s})),c={display:"flex",flexDirection:"column",overflow:"hidden"};return(w,E)=>{const k=br,u=sr,_=ge,O=rr,z=Lo("router-view"),$=er,A=Zt,G=Gt;return j(),W(be,null,[T(A,{"has-sider":!q(i),class:"app-shell"},{default:L(()=>[q(i)?ee("",!0):(j(),ie(u,{key:0,bordered:"","collapse-mode":"width","collapsed-width":64,width:180,collapsed:n.value,"content-style":c,"show-trigger":"",onCollapse:E[0]||(E[0]=R=>n.value=!0),onExpand:E[1]||(E[1]=R=>n.value=!1)},{default:L(()=>[C("div",{class:mo(["brand",{compact:n.value}])},[C("img",{class:"brand-mark",src:q(oo),alt:"系统 Logo"},null,8,fn),n.value?ee("",!0):(j(),W("span",gn,"HXNI 电气无忧"))],2),T(k,{class:"sider-menu",collapsed:n.value,"collapsed-width":64,"icon-size":16,"collapsed-icon-size":18,options:m.value,value:String(q(o).name||"")},null,8,["collapsed","options","value"]),C("div",bn,[T(so,{collapsed:n.value},null,8,["collapsed"])])]),_:1},8,["collapsed"])),T(A,null,{default:L(()=>[q(i)?(j(),ie(O,{key:0,bordered:"",class:"mobile-topbar"},{default:L(()=>[C("button",{type:"button",class:"menu-toggle","aria-label":"打开导航菜单",onClick:E[2]||(E[2]=R=>l.value=!0)},[T(_,{size:18},{default:L(()=>[T(q(Br))]),_:1})]),C("div",wn,le(q(o).meta.title),1)]),_:1})):ee("",!0),T($,{class:"app-content","native-scrollbar":!1},{default:L(()=>[T(z,null,{default:L(({Component:R,route:b})=>[(j(),ie(Ho,{max:6},[b.meta.keepAlive?(j(),ie(Je(R),{key:String(b.name)})):ee("",!0)],1024)),b.meta.keepAlive?ee("",!0):(j(),ie(Je(R),{key:String(b.name)}))]),_:1})]),_:1})]),_:1})]),_:1},8,["has-sider"]),T(G,{show:l.value,"onUpdate:show":E[3]||(E[3]=R=>l.value=R),placement:"left",width:250,"z-index":2e3,"content-style":c,"aria-label":"导航菜单"},{default:L(()=>[C("div",xn,[C("img",{class:"brand-mark",src:q(oo),alt:"系统 Logo"},null,8,yn),E[4]||(E[4]=C("span",null,"HXNI 电气无忧",-1))]),T(k,{class:"drawer-menu","icon-size":16,options:m.value,value:String(q(o).name||""),"onUpdate:value":s},null,8,["options","value"]),C("div",Cn,[T(so,{"z-index":2001})])]),_:1},8,["show"])],64)}}}),Zn=Le(kn,[["__scopeId","data-v-2faad1dc"]]);export{Zn as default};
