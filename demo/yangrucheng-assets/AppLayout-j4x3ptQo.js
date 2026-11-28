import{j as B,k as h,B as Fe,q as Ct,v as kt,D as at,r as D,n as je,w as ge,b as Gt,c as y,i as oe,p as Z,t as ce,F as be,Q as N,R as K,a5 as Ve,$ as C,a6 as qt,W as I,U as j,L as U,a7 as Jt,a4 as st,a3 as Ae,E as _e,a1 as ne,a2 as Q,a0 as _t,P as zt,S as ve,h as le,G as Qt,a8 as ct,a9 as Zt,V as eo}from"./vendor-vue-BcMl6tRj.js";import{F as to,S as We,f as ue,g as oo,i as ro,j as St,k as no,l as io,p as lo,m as ao,n as b,o as ze,q as g,t as E,v as w,w as so,L as co,x as uo,y as te,z as ho,A as we,C as vo,D as mo,E as X,G as po,H as fo,I as go,J as dt,K as xe,M as It,N as $t,O as he,P as bo,Q as se,R as Ye,T as Ke,U as Ne,V as wo,W as xo,X as yo,Y as Co,u as Xe,e as Rt,Z as ko,B as _o,a as ut,$ as zo,b as So,a0 as Mt,a1 as Io,a2 as $o,a3 as Ro,a4 as Mo,a5 as To}from"./index-CnuJBKRN.js";import{N as pe}from"./Icon-pB8kN9le.js";import{D as Eo,F as ht,C as Po,W as Oo}from"./WarningOutline-wYY8xJmd.js";import{C as Bo,_ as Ge}from"./Dropdown-DNS3G4ax.js";import{_ as Se}from"./_plugin-vue_export-helper-DlAUqK2U.js";import{_ as Ao}from"./InputGroup-pcYSQcAZ.js";import{_ as No}from"./Divider-BpZwZJ90.js";import{_ as Ho}from"./Space-Ddcb0Hkh.js";import{u as Lo}from"./use-message-DyK1Wwb6.js";import{_ as Fo,a as jo}from"./FormItem-B8BxG2b-.js";import{_ as Ko}from"./Input-opkA_inf.js";import{a as vt}from"./branding-C4RVVTUU.js";import{u as fe}from"./get-DsD_x2cB.js";import{d as Uo,m as Do}from"./light-BtV1XLoq.js";import{f as me}from"./format-length-B-p6aW7q.js";import{N as Vo}from"./Tooltip-DtSvDB7L.js";import{V as Wo,c as He}from"./Popover-p3SnkF9O.js";import{u as Yo}from"./use-compitable-CE4Atwgp.js";import"./light-B9F2kUra.js";import"./use-keyboard-Dv9k_gPf.js";import"./light-w6l29Lfu.js";import"./light-aa0_xnGc.js";import"./light-CCxy0N-m.js";import"./get-slot-Bk_rJcZu.js";import"./_common-h0mJDxlK.js";import"./light-B8Glldh4.js";import"./use-locale-DbmYz_I2.js";import"./light-DvfP9rFz.js";import"./light-C8uoskwS.js";const Xo=B({name:"ChevronDownFilled",render(){return h("svg",{viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg"},h("path",{d:"M3.20041 5.73966C3.48226 5.43613 3.95681 5.41856 4.26034 5.70041L8 9.22652L11.7397 5.70041C12.0432 5.41856 12.5177 5.43613 12.7996 5.73966C13.0815 6.0432 13.0639 6.51775 12.7603 6.7996L8.51034 10.7996C8.22258 11.0668 7.77743 11.0668 7.48967 10.7996L3.23966 6.7996C2.93613 6.51775 2.91856 6.0432 3.20041 5.73966Z",fill:"currentColor"}))}}),Go=B({name:"NDrawerContent",inheritAttrs:!1,props:{blockScroll:Boolean,show:{type:Boolean,default:void 0},displayDirective:{type:String,required:!0},placement:{type:String,required:!0},contentClass:String,contentStyle:[Object,String],nativeScrollbar:{type:Boolean,required:!0},scrollbarProps:Object,trapFocus:{type:Boolean,default:!0},autoFocus:{type:Boolean,default:!0},showMask:{type:[Boolean,String],required:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,onClickoutside:Function,onAfterLeave:Function,onAfterEnter:Function,onEsc:Function},setup(e){const o=D(!!e.show),t=D(null),r=oe(St);let n=0,l="",a=null;const f=D(!1),c=D(!1),p=y(()=>e.placement==="top"||e.placement==="bottom"),{mergedClsPrefixRef:P,mergedRtlRef:_}=ue(e),u=oo("Drawer",_,P),v=d,x=R=>{c.value=!0,n=p.value?R.clientY:R.clientX,l=document.body.style.cursor,document.body.style.cursor=p.value?"ns-resize":"ew-resize",document.body.addEventListener("mousemove",$),document.body.addEventListener("mouseleave",v),document.body.addEventListener("mouseup",d)},S=()=>{a!==null&&(window.clearTimeout(a),a=null),c.value?f.value=!0:a=window.setTimeout(()=>{f.value=!0},300)},T=()=>{a!==null&&(window.clearTimeout(a),a=null),f.value=!1},{doUpdateHeight:L,doUpdateWidth:J}=r,A=R=>{const{maxWidth:W}=e;if(W&&R>W)return W;const{minWidth:F}=e;return F&&R<F?F:R},k=R=>{const{maxHeight:W}=e;if(W&&R>W)return W;const{minHeight:F}=e;return F&&R<F?F:R};function $(R){var W,F;if(c.value)if(p.value){let q=((W=t.value)===null||W===void 0?void 0:W.offsetHeight)||0;const Y=n-R.clientY;q+=e.placement==="bottom"?Y:-Y,q=k(q),L(q),n=R.clientY}else{let q=((F=t.value)===null||F===void 0?void 0:F.offsetWidth)||0;const Y=n-R.clientX;q+=e.placement==="right"?Y:-Y,q=A(q),J(q),n=R.clientX}}function d(){c.value&&(n=0,c.value=!1,document.body.style.cursor=l,document.body.removeEventListener("mousemove",$),document.body.removeEventListener("mouseup",d),document.body.removeEventListener("mouseleave",v))}je(()=>{e.show&&(o.value=!0)}),ge(()=>e.show,R=>{R||d()}),Gt(()=>{d()});const m=y(()=>{const{show:R}=e,W=[[at,R]];return e.showMask||W.push([no,e.onClickoutside,void 0,{capture:!0}]),W});function H(){var R;o.value=!1,(R=e.onAfterLeave)===null||R===void 0||R.call(e)}return ro(y(()=>e.blockScroll&&o.value)),Z(io,t),Z(lo,null),Z(ao,null),{bodyRef:t,rtlEnabled:u,mergedClsPrefix:r.mergedClsPrefixRef,isMounted:r.isMountedRef,mergedTheme:r.mergedThemeRef,displayed:o,transitionName:y(()=>({right:"slide-in-from-right-transition",left:"slide-in-from-left-transition",top:"slide-in-from-top-transition",bottom:"slide-in-from-bottom-transition"})[e.placement]),handleAfterLeave:H,bodyDirectives:m,handleMousedownResizeTrigger:x,handleMouseenterResizeTrigger:S,handleMouseleaveResizeTrigger:T,isDragging:c,isHoverOnResizeTrigger:f}},render(){const{$slots:e,mergedClsPrefix:o}=this;return this.displayDirective==="show"||this.displayed||this.show?Fe(h("div",{role:"none"},h(to,{disabled:!this.showMask||!this.trapFocus,active:this.show,autoFocus:this.autoFocus,onEsc:this.onEsc},{default:()=>h(Ct,{name:this.transitionName,appear:this.isMounted,onAfterEnter:this.onAfterEnter,onAfterLeave:this.handleAfterLeave},{default:()=>Fe(h("div",kt(this.$attrs,{role:"dialog",ref:"bodyRef","aria-modal":"true",class:[`${o}-drawer`,this.rtlEnabled&&`${o}-drawer--rtl`,`${o}-drawer--${this.placement}-placement`,this.isDragging&&`${o}-drawer--unselectable`,this.nativeScrollbar&&`${o}-drawer--native-scrollbar`]}),[this.resizable?h("div",{class:[`${o}-drawer__resize-trigger`,(this.isDragging||this.isHoverOnResizeTrigger)&&`${o}-drawer__resize-trigger--hover`],onMouseenter:this.handleMouseenterResizeTrigger,onMouseleave:this.handleMouseleaveResizeTrigger,onMousedown:this.handleMousedownResizeTrigger}):null,this.nativeScrollbar?h("div",{class:[`${o}-drawer-content-wrapper`,this.contentClass],style:this.contentStyle,role:"none"},e):h(We,Object.assign({},this.scrollbarProps,{contentStyle:this.contentStyle,contentClass:[`${o}-drawer-content-wrapper`,this.contentClass],theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar}),e)]),this.bodyDirectives)})})),[[at,this.displayDirective==="if"||this.displayed||this.show]]):null}}),{cubicBezierEaseIn:qo,cubicBezierEaseOut:Jo}=ze;function Qo({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-bottom"}={}){return[b(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${qo}`}),b(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${Jo}`}),b(`&.${t}-transition-enter-to`,{transform:"translateY(0)"}),b(`&.${t}-transition-enter-from`,{transform:"translateY(100%)"}),b(`&.${t}-transition-leave-from`,{transform:"translateY(0)"}),b(`&.${t}-transition-leave-to`,{transform:"translateY(100%)"})]}const{cubicBezierEaseIn:Zo,cubicBezierEaseOut:er}=ze;function tr({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-left"}={}){return[b(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${Zo}`}),b(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${er}`}),b(`&.${t}-transition-enter-to`,{transform:"translateX(0)"}),b(`&.${t}-transition-enter-from`,{transform:"translateX(-100%)"}),b(`&.${t}-transition-leave-from`,{transform:"translateX(0)"}),b(`&.${t}-transition-leave-to`,{transform:"translateX(-100%)"})]}const{cubicBezierEaseIn:or,cubicBezierEaseOut:rr}=ze;function nr({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-right"}={}){return[b(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${or}`}),b(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${rr}`}),b(`&.${t}-transition-enter-to`,{transform:"translateX(0)"}),b(`&.${t}-transition-enter-from`,{transform:"translateX(100%)"}),b(`&.${t}-transition-leave-from`,{transform:"translateX(0)"}),b(`&.${t}-transition-leave-to`,{transform:"translateX(100%)"})]}const{cubicBezierEaseIn:ir,cubicBezierEaseOut:lr}=ze;function ar({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-top"}={}){return[b(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${ir}`}),b(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${lr}`}),b(`&.${t}-transition-enter-to`,{transform:"translateY(0)"}),b(`&.${t}-transition-enter-from`,{transform:"translateY(-100%)"}),b(`&.${t}-transition-leave-from`,{transform:"translateY(0)"}),b(`&.${t}-transition-leave-to`,{transform:"translateY(-100%)"})]}const sr=b([g("drawer",`
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
 `,[nr(),tr(),ar(),Qo(),E("unselectable",`
 user-select: none; 
 -webkit-user-select: none;
 `),E("native-scrollbar",[g("drawer-content-wrapper",`
 overflow: auto;
 height: 100%;
 `)]),w("resize-trigger",`
 position: absolute;
 background-color: #0000;
 transition: background-color .3s var(--n-bezier);
 `,[E("hover",`
 background-color: var(--n-resize-trigger-color-hover);
 `)]),g("drawer-content-wrapper",`
 box-sizing: border-box;
 `),g("drawer-content",`
 height: 100%;
 display: flex;
 flex-direction: column;
 `,[E("native-scrollbar",[g("drawer-body-content-wrapper",`
 height: 100%;
 overflow: auto;
 `)]),g("drawer-body",`
 flex: 1 0 0;
 overflow: hidden;
 `),g("drawer-body-content-wrapper",`
 box-sizing: border-box;
 padding: var(--n-body-padding);
 `),g("drawer-header",`
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
 `,[w("main",`
 flex: 1;
 `),w("close",`
 margin-left: 6px;
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `)]),g("drawer-footer",`
 display: flex;
 justify-content: flex-end;
 border-top: var(--n-footer-border-top);
 transition: border .3s var(--n-bezier);
 padding: var(--n-footer-padding);
 `)]),E("right-placement",`
 top: 0;
 bottom: 0;
 right: 0;
 border-top-left-radius: var(--n-border-radius);
 border-bottom-left-radius: var(--n-border-radius);
 `,[w("resize-trigger",`
 width: 3px;
 height: 100%;
 top: 0;
 left: 0;
 transform: translateX(-1.5px);
 cursor: ew-resize;
 `)]),E("left-placement",`
 top: 0;
 bottom: 0;
 left: 0;
 border-top-right-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `,[w("resize-trigger",`
 width: 3px;
 height: 100%;
 top: 0;
 right: 0;
 transform: translateX(1.5px);
 cursor: ew-resize;
 `)]),E("top-placement",`
 top: 0;
 left: 0;
 right: 0;
 border-bottom-left-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `,[w("resize-trigger",`
 width: 100%;
 height: 3px;
 bottom: 0;
 left: 0;
 transform: translateY(1.5px);
 cursor: ns-resize;
 `)]),E("bottom-placement",`
 left: 0;
 bottom: 0;
 right: 0;
 border-top-left-radius: var(--n-border-radius);
 border-top-right-radius: var(--n-border-radius);
 `,[w("resize-trigger",`
 width: 100%;
 height: 3px;
 top: 0;
 left: 0;
 transform: translateY(-1.5px);
 cursor: ns-resize;
 `)])]),b("body",[b(">",[g("drawer-container",`
 position: fixed;
 `)])]),g("drawer-container",`
 position: relative;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 pointer-events: none;
 `,[b("> *",`
 pointer-events: all;
 `)]),g("drawer-mask",`
 background-color: rgba(0, 0, 0, .3);
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `,[E("invisible",`
 background-color: rgba(0, 0, 0, 0)
 `),so({enterDuration:"0.2s",leaveDuration:"0.2s",enterCubicBezier:"var(--n-bezier-in)",leaveCubicBezier:"var(--n-bezier-out)"})])]),cr=Object.assign(Object.assign({},te.props),{show:Boolean,width:[Number,String],height:[Number,String],placement:{type:String,default:"right"},maskClosable:{type:Boolean,default:!0},showMask:{type:[Boolean,String],default:!0},to:[String,Object],displayDirective:{type:String,default:"if"},nativeScrollbar:{type:Boolean,default:!0},zIndex:Number,onMaskClick:Function,scrollbarProps:Object,contentClass:String,contentStyle:[Object,String],trapFocus:{type:Boolean,default:!0},onEsc:Function,autoFocus:{type:Boolean,default:!0},closeOnEsc:{type:Boolean,default:!0},blockScroll:{type:Boolean,default:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,defaultWidth:{type:[Number,String],default:251},defaultHeight:{type:[Number,String],default:251},onUpdateWidth:[Function,Array],onUpdateHeight:[Function,Array],"onUpdate:width":[Function,Array],"onUpdate:height":[Function,Array],"onUpdate:show":[Function,Array],onUpdateShow:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,drawerStyle:[String,Object],drawerClass:String,target:null,onShow:Function,onHide:Function}),dr=B({name:"Drawer",inheritAttrs:!1,props:cr,setup(e){const{mergedClsPrefixRef:o,namespaceRef:t,inlineThemeDisabled:r}=ue(e),n=uo(),l=te("Drawer","-drawer",sr,Uo,e,o),a=D(e.defaultWidth),f=D(e.defaultHeight),c=fe(ce(e,"width"),a),p=fe(ce(e,"height"),f),P=y(()=>{const{placement:d}=e;return d==="top"||d==="bottom"?"":me(c.value)}),_=y(()=>{const{placement:d}=e;return d==="left"||d==="right"?"":me(p.value)}),u=d=>{const{onUpdateWidth:m,"onUpdate:width":H}=e;m&&X(m,d),H&&X(H,d),a.value=d},v=d=>{const{onUpdateHeight:m,"onUpdate:width":H}=e;m&&X(m,d),H&&X(H,d),f.value=d},x=y(()=>[{width:P.value,height:_.value},e.drawerStyle||""]);function S(d){const{onMaskClick:m,maskClosable:H}=e;H&&A(!1),m&&m(d)}function T(d){S(d)}const L=ho();function J(d){var m;(m=e.onEsc)===null||m===void 0||m.call(e),e.show&&e.closeOnEsc&&mo(d)&&(L.value||A(!1))}function A(d){const{onHide:m,onUpdateShow:H,"onUpdate:show":R}=e;H&&X(H,d),R&&X(R,d),m&&!d&&X(m,d)}Z(St,{isMountedRef:n,mergedThemeRef:l,mergedClsPrefixRef:o,doUpdateShow:A,doUpdateHeight:v,doUpdateWidth:u});const k=y(()=>{const{common:{cubicBezierEaseInOut:d,cubicBezierEaseIn:m,cubicBezierEaseOut:H},self:{color:R,textColor:W,boxShadow:F,lineHeight:q,headerPadding:Y,footerPadding:ie,borderRadius:Ie,bodyPadding:$e,titleFontSize:Re,titleTextColor:Me,titleFontWeight:Te,headerBorderBottom:Ee,footerBorderTop:z,closeIconColor:O,closeIconColorHover:i,closeIconColorPressed:M,closeColorHover:V,closeColorPressed:Pe,closeIconSize:Oe,closeSize:Be,closeBorderRadius:s,resizableTriggerColorHover:Xt}}=l.value;return{"--n-line-height":q,"--n-color":R,"--n-border-radius":Ie,"--n-text-color":W,"--n-box-shadow":F,"--n-bezier":d,"--n-bezier-out":H,"--n-bezier-in":m,"--n-header-padding":Y,"--n-body-padding":$e,"--n-footer-padding":ie,"--n-title-text-color":Me,"--n-title-font-size":Re,"--n-title-font-weight":Te,"--n-header-border-bottom":Ee,"--n-footer-border-top":z,"--n-close-icon-color":O,"--n-close-icon-color-hover":i,"--n-close-icon-color-pressed":M,"--n-close-size":Be,"--n-close-color-hover":V,"--n-close-color-pressed":Pe,"--n-close-icon-size":Oe,"--n-close-border-radius":s,"--n-resize-trigger-color-hover":Xt}}),$=r?we("drawer",void 0,k,e):void 0;return{mergedClsPrefix:o,namespace:t,mergedBodyStyle:x,handleOutsideClick:T,handleMaskClick:S,handleEsc:J,mergedTheme:l,cssVars:r?void 0:k,themeClass:$?.themeClass,onRender:$?.onRender,isMounted:n}},render(){const{mergedClsPrefix:e}=this;return h(co,{to:this.to,show:this.show},{default:()=>{var o;return(o=this.onRender)===null||o===void 0||o.call(this),Fe(h("div",{class:[`${e}-drawer-container`,this.namespace,this.themeClass],style:this.cssVars,role:"none"},this.showMask?h(Ct,{name:"fade-in-transition",appear:this.isMounted},{default:()=>this.show?h("div",{"aria-hidden":!0,class:[`${e}-drawer-mask`,this.showMask==="transparent"&&`${e}-drawer-mask--invisible`],onClick:this.handleMaskClick}):null}):null,h(Go,Object.assign({},this.$attrs,{class:[this.drawerClass,this.$attrs.class],style:[this.mergedBodyStyle,this.$attrs.style],blockScroll:this.blockScroll,contentStyle:this.contentStyle,contentClass:this.contentClass,placement:this.placement,scrollbarProps:this.scrollbarProps,show:this.show,displayDirective:this.displayDirective,nativeScrollbar:this.nativeScrollbar,onAfterEnter:this.onAfterEnter,onAfterLeave:this.onAfterLeave,trapFocus:this.trapFocus,autoFocus:this.autoFocus,resizable:this.resizable,maxHeight:this.maxHeight,minHeight:this.minHeight,maxWidth:this.maxWidth,minWidth:this.minWidth,showMask:this.showMask,onEsc:this.handleEsc,onClickoutside:this.handleOutsideClick}),this.$slots)),[[vo,{zIndex:this.zIndex,enabled:this.show}]])}})}});function ur(e){const{baseColor:o,textColor2:t,bodyColor:r,cardColor:n,dividerColor:l,actionColor:a,scrollbarColor:f,scrollbarColorHover:c,invertedColor:p}=e;return{textColor:t,textColorInverted:"#FFF",color:r,colorEmbedded:a,headerColor:n,headerColorInverted:p,footerColor:a,footerColorInverted:p,headerBorderColor:l,headerBorderColorInverted:p,footerBorderColor:l,footerBorderColorInverted:p,siderBorderColor:l,siderBorderColorInverted:p,siderColor:n,siderColorInverted:p,siderToggleButtonBorder:`1px solid ${l}`,siderToggleButtonColor:o,siderToggleButtonIconColor:t,siderToggleButtonIconColorInverted:t,siderToggleBarColor:dt(r,f),siderToggleBarColorHover:dt(r,c),__invertScrollbar:"true"}}const qe=po({name:"Layout",common:go,peers:{Scrollbar:fo},self:ur}),Tt=xe("n-layout-sider"),Je={type:String,default:"static"},hr=g("layout",`
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
`,[g("layout-scroll-container",`
 overflow-x: hidden;
 box-sizing: border-box;
 height: 100%;
 `),E("absolute-positioned",`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),vr={embedded:Boolean,position:Je,nativeScrollbar:{type:Boolean,default:!0},scrollbarProps:Object,onScroll:Function,contentClass:String,contentStyle:{type:[String,Object],default:""},hasSider:Boolean,siderPlacement:{type:String,default:"left"}},Et=xe("n-layout");function Pt(e){return B({name:e?"LayoutContent":"Layout",props:Object.assign(Object.assign({},te.props),vr),setup(o){const t=D(null),r=D(null),{mergedClsPrefixRef:n,inlineThemeDisabled:l}=ue(o),a=te("Layout","-layout",hr,qe,o,n);function f(S,T){if(o.nativeScrollbar){const{value:L}=t;L&&(T===void 0?L.scrollTo(S):L.scrollTo(S,T))}else{const{value:L}=r;L&&L.scrollTo(S,T)}}Z(Et,o);let c=0,p=0;const P=S=>{var T;const L=S.target;c=L.scrollLeft,p=L.scrollTop,(T=o.onScroll)===null||T===void 0||T.call(o,S)};It(()=>{if(o.nativeScrollbar){const S=t.value;S&&(S.scrollTop=p,S.scrollLeft=c)}});const _={display:"flex",flexWrap:"nowrap",width:"100%",flexDirection:"row"},u={scrollTo:f},v=y(()=>{const{common:{cubicBezierEaseInOut:S},self:T}=a.value;return{"--n-bezier":S,"--n-color":o.embedded?T.colorEmbedded:T.color,"--n-text-color":T.textColor}}),x=l?we("layout",y(()=>o.embedded?"e":""),v,o):void 0;return Object.assign({mergedClsPrefix:n,scrollableElRef:t,scrollbarInstRef:r,hasSiderStyle:_,mergedTheme:a,handleNativeElScroll:P,cssVars:l?void 0:v,themeClass:x?.themeClass,onRender:x?.onRender},u)},render(){var o;const{mergedClsPrefix:t,hasSider:r}=this;(o=this.onRender)===null||o===void 0||o.call(this);const n=r?this.hasSiderStyle:void 0,l=[this.themeClass,e&&`${t}-layout-content`,`${t}-layout`,`${t}-layout--${this.position}-positioned`];return h("div",{class:l,style:this.cssVars},this.nativeScrollbar?h("div",{ref:"scrollableElRef",class:[`${t}-layout-scroll-container`,this.contentClass],style:[this.contentStyle,n],onScroll:this.handleNativeElScroll},this.$slots):h(We,Object.assign({},this.scrollbarProps,{onScroll:this.onScroll,ref:"scrollbarInstRef",theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,contentClass:this.contentClass,contentStyle:[this.contentStyle,n]}),this.$slots))}})}const mr=Pt(!1),pr=Pt(!0),fr=g("layout-header",`
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 box-sizing: border-box;
 width: 100%;
 background-color: var(--n-color);
 color: var(--n-text-color);
`,[E("absolute-positioned",`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 `),E("bordered",`
 border-bottom: solid 1px var(--n-border-color);
 `)]),gr={position:Je,inverted:Boolean,bordered:{type:Boolean,default:!1}},br=B({name:"LayoutHeader",props:Object.assign(Object.assign({},te.props),gr),setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:t}=ue(e),r=te("Layout","-layout-header",fr,qe,e,o),n=y(()=>{const{common:{cubicBezierEaseInOut:a},self:f}=r.value,c={"--n-bezier":a};return e.inverted?(c["--n-color"]=f.headerColorInverted,c["--n-text-color"]=f.textColorInverted,c["--n-border-color"]=f.headerBorderColorInverted):(c["--n-color"]=f.headerColor,c["--n-text-color"]=f.textColor,c["--n-border-color"]=f.headerBorderColor),c}),l=t?we("layout-header",y(()=>e.inverted?"a":"b"),n,e):void 0;return{mergedClsPrefix:o,cssVars:t?void 0:n,themeClass:l?.themeClass,onRender:l?.onRender}},render(){var e;const{mergedClsPrefix:o}=this;return(e=this.onRender)===null||e===void 0||e.call(this),h("div",{class:[`${o}-layout-header`,this.themeClass,this.position&&`${o}-layout-header--${this.position}-positioned`,this.bordered&&`${o}-layout-header--bordered`],style:this.cssVars},this.$slots)}}),wr=g("layout-sider",`
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
`,[E("bordered",[w("border",`
 content: "";
 position: absolute;
 top: 0;
 bottom: 0;
 width: 1px;
 background-color: var(--n-border-color);
 transition: background-color .3s var(--n-bezier);
 `)]),w("left-placement",[E("bordered",[w("border",`
 right: 0;
 `)])]),E("right-placement",`
 justify-content: flex-start;
 `,[E("bordered",[w("border",`
 left: 0;
 `)]),E("collapsed",[g("layout-toggle-button",[g("base-icon",`
 transform: rotate(180deg);
 `)]),g("layout-toggle-bar",[b("&:hover",[w("top",{transform:"rotate(-12deg) scale(1.15) translateY(-2px)"}),w("bottom",{transform:"rotate(12deg) scale(1.15) translateY(2px)"})])])]),g("layout-toggle-button",`
 left: 0;
 transform: translateX(-50%) translateY(-50%);
 `,[g("base-icon",`
 transform: rotate(0);
 `)]),g("layout-toggle-bar",`
 left: -28px;
 transform: rotate(180deg);
 `,[b("&:hover",[w("top",{transform:"rotate(12deg) scale(1.15) translateY(-2px)"}),w("bottom",{transform:"rotate(-12deg) scale(1.15) translateY(2px)"})])])]),E("collapsed",[g("layout-toggle-bar",[b("&:hover",[w("top",{transform:"rotate(-12deg) scale(1.15) translateY(-2px)"}),w("bottom",{transform:"rotate(12deg) scale(1.15) translateY(2px)"})])]),g("layout-toggle-button",[g("base-icon",`
 transform: rotate(0);
 `)])]),g("layout-toggle-button",`
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
 `,[g("base-icon",`
 transition: transform .3s var(--n-bezier);
 transform: rotate(180deg);
 `)]),g("layout-toggle-bar",`
 cursor: pointer;
 height: 72px;
 width: 32px;
 position: absolute;
 top: calc(50% - 36px);
 right: -28px;
 `,[w("top, bottom",`
 position: absolute;
 width: 4px;
 border-radius: 2px;
 height: 38px;
 left: 14px;
 transition: 
 background-color .3s var(--n-bezier),
 transform .3s var(--n-bezier);
 `),w("bottom",`
 position: absolute;
 top: 34px;
 `),b("&:hover",[w("top",{transform:"rotate(12deg) scale(1.15) translateY(-2px)"}),w("bottom",{transform:"rotate(-12deg) scale(1.15) translateY(2px)"})]),w("top, bottom",{backgroundColor:"var(--n-toggle-bar-color)"}),b("&:hover",[w("top, bottom",{backgroundColor:"var(--n-toggle-bar-color-hover)"})])]),w("border",`
 position: absolute;
 top: 0;
 right: 0;
 bottom: 0;
 width: 1px;
 transition: background-color .3s var(--n-bezier);
 `),g("layout-sider-scroll-container",`
 flex-grow: 1;
 flex-shrink: 0;
 box-sizing: border-box;
 height: 100%;
 opacity: 0;
 transition: opacity .3s var(--n-bezier);
 max-width: 100%;
 `),E("show-content",[g("layout-sider-scroll-container",{opacity:1})]),E("absolute-positioned",`
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 `)]),xr=B({props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){const{clsPrefix:e}=this;return h("div",{onClick:this.onClick,class:`${e}-layout-toggle-bar`},h("div",{class:`${e}-layout-toggle-bar__top`}),h("div",{class:`${e}-layout-toggle-bar__bottom`}))}}),yr=B({name:"LayoutToggleButton",props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){const{clsPrefix:e}=this;return h("div",{class:`${e}-layout-toggle-button`,onClick:this.onClick},h($t,{clsPrefix:e},{default:()=>h(Bo,null)}))}}),Cr={position:Je,bordered:Boolean,collapsedWidth:{type:Number,default:48},width:{type:[Number,String],default:272},contentClass:String,contentStyle:{type:[String,Object],default:""},collapseMode:{type:String,default:"transform"},collapsed:{type:Boolean,default:void 0},defaultCollapsed:Boolean,showCollapsedContent:{type:Boolean,default:!0},showTrigger:{type:[Boolean,String],default:!1},nativeScrollbar:{type:Boolean,default:!0},inverted:Boolean,scrollbarProps:Object,triggerClass:String,triggerStyle:[String,Object],collapsedTriggerClass:String,collapsedTriggerStyle:[String,Object],"onUpdate:collapsed":[Function,Array],onUpdateCollapsed:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,onExpand:[Function,Array],onCollapse:[Function,Array],onScroll:Function},kr=B({name:"LayoutSider",props:Object.assign(Object.assign({},te.props),Cr),setup(e){const o=oe(Et),t=D(null),r=D(null),n=D(e.defaultCollapsed),l=fe(ce(e,"collapsed"),n),a=y(()=>me(l.value?e.collapsedWidth:e.width)),f=y(()=>e.collapseMode!=="transform"?{}:{minWidth:me(e.width)}),c=y(()=>o?o.siderPlacement:"left");function p($,d){if(e.nativeScrollbar){const{value:m}=t;m&&(d===void 0?m.scrollTo($):m.scrollTo($,d))}else{const{value:m}=r;m&&m.scrollTo($,d)}}function P(){const{"onUpdate:collapsed":$,onUpdateCollapsed:d,onExpand:m,onCollapse:H}=e,{value:R}=l;d&&X(d,!R),$&&X($,!R),n.value=!R,R?m&&X(m):H&&X(H)}let _=0,u=0;const v=$=>{var d;const m=$.target;_=m.scrollLeft,u=m.scrollTop,(d=e.onScroll)===null||d===void 0||d.call(e,$)};It(()=>{if(e.nativeScrollbar){const $=t.value;$&&($.scrollTop=u,$.scrollLeft=_)}}),Z(Tt,{collapsedRef:l,collapseModeRef:ce(e,"collapseMode")});const{mergedClsPrefixRef:x,inlineThemeDisabled:S}=ue(e),T=te("Layout","-layout-sider",wr,qe,e,x);function L($){var d,m;$.propertyName==="max-width"&&(l.value?(d=e.onAfterLeave)===null||d===void 0||d.call(e):(m=e.onAfterEnter)===null||m===void 0||m.call(e))}const J={scrollTo:p},A=y(()=>{const{common:{cubicBezierEaseInOut:$},self:d}=T.value,{siderToggleButtonColor:m,siderToggleButtonBorder:H,siderToggleBarColor:R,siderToggleBarColorHover:W}=d,F={"--n-bezier":$,"--n-toggle-button-color":m,"--n-toggle-button-border":H,"--n-toggle-bar-color":R,"--n-toggle-bar-color-hover":W};return e.inverted?(F["--n-color"]=d.siderColorInverted,F["--n-text-color"]=d.textColorInverted,F["--n-border-color"]=d.siderBorderColorInverted,F["--n-toggle-button-icon-color"]=d.siderToggleButtonIconColorInverted,F.__invertScrollbar=d.__invertScrollbar):(F["--n-color"]=d.siderColor,F["--n-text-color"]=d.textColor,F["--n-border-color"]=d.siderBorderColor,F["--n-toggle-button-icon-color"]=d.siderToggleButtonIconColor),F}),k=S?we("layout-sider",y(()=>e.inverted?"a":"b"),A,e):void 0;return Object.assign({scrollableElRef:t,scrollbarInstRef:r,mergedClsPrefix:x,mergedTheme:T,styleMaxWidth:a,mergedCollapsed:l,scrollContainerStyle:f,siderPlacement:c,handleNativeElScroll:v,handleTransitionend:L,handleTriggerClick:P,inlineThemeDisabled:S,cssVars:A,themeClass:k?.themeClass,onRender:k?.onRender},J)},render(){var e;const{mergedClsPrefix:o,mergedCollapsed:t,showTrigger:r}=this;return(e=this.onRender)===null||e===void 0||e.call(this),h("aside",{class:[`${o}-layout-sider`,this.themeClass,`${o}-layout-sider--${this.position}-positioned`,`${o}-layout-sider--${this.siderPlacement}-placement`,this.bordered&&`${o}-layout-sider--bordered`,t&&`${o}-layout-sider--collapsed`,(!t||this.showCollapsedContent)&&`${o}-layout-sider--show-content`],onTransitionend:this.handleTransitionend,style:[this.inlineThemeDisabled?void 0:this.cssVars,{maxWidth:this.styleMaxWidth,width:me(this.width)}]},this.nativeScrollbar?h("div",{class:[`${o}-layout-sider-scroll-container`,this.contentClass],onScroll:this.handleNativeElScroll,style:[this.scrollContainerStyle,{overflow:"auto"},this.contentStyle],ref:"scrollableElRef"},this.$slots):h(We,Object.assign({},this.scrollbarProps,{onScroll:this.onScroll,ref:"scrollbarInstRef",style:this.scrollContainerStyle,contentStyle:this.contentStyle,contentClass:this.contentClass,theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,builtinThemeOverrides:this.inverted&&this.cssVars.__invertScrollbar==="true"?{colorHover:"rgba(255, 255, 255, .4)",color:"rgba(255, 255, 255, .3)"}:void 0}),this.$slots),r?r==="bar"?h(xr,{clsPrefix:o,class:t?this.collapsedTriggerClass:this.triggerClass,style:t?this.collapsedTriggerStyle:this.triggerStyle,onClick:this.handleTriggerClick}):h(yr,{clsPrefix:o,class:t?this.collapsedTriggerClass:this.triggerClass,style:t?this.collapsedTriggerStyle:this.triggerStyle,onClick:this.handleTriggerClick}):null,this.bordered?h("div",{class:`${o}-layout-sider__border`}):null)}}),ye=xe("n-menu"),Ot=xe("n-submenu"),Qe=xe("n-menu-item-group"),mt=[b("&::before","background-color: var(--n-item-color-hover);"),w("arrow",`
 color: var(--n-arrow-color-hover);
 `),w("icon",`
 color: var(--n-item-icon-color-hover);
 `),g("menu-item-content-header",`
 color: var(--n-item-text-color-hover);
 `,[b("a",`
 color: var(--n-item-text-color-hover);
 `),w("extra",`
 color: var(--n-item-text-color-hover);
 `)])],pt=[w("icon",`
 color: var(--n-item-icon-color-hover-horizontal);
 `),g("menu-item-content-header",`
 color: var(--n-item-text-color-hover-horizontal);
 `,[b("a",`
 color: var(--n-item-text-color-hover-horizontal);
 `),w("extra",`
 color: var(--n-item-text-color-hover-horizontal);
 `)])],_r=b([g("menu",`
 background-color: var(--n-color);
 color: var(--n-item-text-color);
 overflow: hidden;
 transition: background-color .3s var(--n-bezier);
 box-sizing: border-box;
 font-size: var(--n-font-size);
 padding-bottom: 6px;
 `,[E("horizontal",`
 max-width: 100%;
 width: 100%;
 display: flex;
 overflow: hidden;
 padding-bottom: 0;
 `,[g("submenu","margin: 0;"),g("menu-item","margin: 0;"),g("menu-item-content",`
 padding: 0 20px;
 border-bottom: 2px solid #0000;
 `,[b("&::before","display: none;"),E("selected","border-bottom: 2px solid var(--n-border-color-horizontal)")]),g("menu-item-content",[E("selected",[w("icon","color: var(--n-item-icon-color-active-horizontal);"),g("menu-item-content-header",`
 color: var(--n-item-text-color-active-horizontal);
 `,[b("a","color: var(--n-item-text-color-active-horizontal);"),w("extra","color: var(--n-item-text-color-active-horizontal);")])]),E("child-active",`
 border-bottom: 2px solid var(--n-border-color-horizontal);
 `,[g("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-horizontal);
 `,[b("a",`
 color: var(--n-item-text-color-child-active-horizontal);
 `),w("extra",`
 color: var(--n-item-text-color-child-active-horizontal);
 `)]),w("icon",`
 color: var(--n-item-icon-color-child-active-horizontal);
 `)]),he("disabled",[he("selected, child-active",[b("&:focus-within",pt)]),E("selected",[re(null,[w("icon","color: var(--n-item-icon-color-active-hover-horizontal);"),g("menu-item-content-header",`
 color: var(--n-item-text-color-active-hover-horizontal);
 `,[b("a","color: var(--n-item-text-color-active-hover-horizontal);"),w("extra","color: var(--n-item-text-color-active-hover-horizontal);")])])]),E("child-active",[re(null,[w("icon","color: var(--n-item-icon-color-child-active-hover-horizontal);"),g("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-hover-horizontal);
 `,[b("a","color: var(--n-item-text-color-child-active-hover-horizontal);"),w("extra","color: var(--n-item-text-color-child-active-hover-horizontal);")])])]),re("border-bottom: 2px solid var(--n-border-color-horizontal);",pt)]),g("menu-item-content-header",[b("a","color: var(--n-item-text-color-horizontal);")])])]),he("responsive",[g("menu-item-content-header",`
 overflow: hidden;
 text-overflow: ellipsis;
 `)]),E("collapsed",[g("menu-item-content",[E("selected",[b("&::before",`
 background-color: var(--n-item-color-active-collapsed) !important;
 `)]),g("menu-item-content-header","opacity: 0;"),w("arrow","opacity: 0;"),w("icon","color: var(--n-item-icon-color-collapsed);")])]),g("menu-item",`
 height: var(--n-item-height);
 margin-top: 6px;
 position: relative;
 `),g("menu-item-content",`
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
 `,[b("> *","z-index: 1;"),b("&::before",`
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
 `),E("disabled",`
 opacity: .45;
 cursor: not-allowed;
 `),E("collapsed",[w("arrow","transform: rotate(0);")]),E("selected",[b("&::before","background-color: var(--n-item-color-active);"),w("arrow","color: var(--n-arrow-color-active);"),w("icon","color: var(--n-item-icon-color-active);"),g("menu-item-content-header",`
 color: var(--n-item-text-color-active);
 `,[b("a","color: var(--n-item-text-color-active);"),w("extra","color: var(--n-item-text-color-active);")])]),E("child-active",[g("menu-item-content-header",`
 color: var(--n-item-text-color-child-active);
 `,[b("a",`
 color: var(--n-item-text-color-child-active);
 `),w("extra",`
 color: var(--n-item-text-color-child-active);
 `)]),w("arrow",`
 color: var(--n-arrow-color-child-active);
 `),w("icon",`
 color: var(--n-item-icon-color-child-active);
 `)]),he("disabled",[he("selected, child-active",[b("&:focus-within",mt)]),E("selected",[re(null,[w("arrow","color: var(--n-arrow-color-active-hover);"),w("icon","color: var(--n-item-icon-color-active-hover);"),g("menu-item-content-header",`
 color: var(--n-item-text-color-active-hover);
 `,[b("a","color: var(--n-item-text-color-active-hover);"),w("extra","color: var(--n-item-text-color-active-hover);")])])]),E("child-active",[re(null,[w("arrow","color: var(--n-arrow-color-child-active-hover);"),w("icon","color: var(--n-item-icon-color-child-active-hover);"),g("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-hover);
 `,[b("a","color: var(--n-item-text-color-child-active-hover);"),w("extra","color: var(--n-item-text-color-child-active-hover);")])])]),E("selected",[re(null,[b("&::before","background-color: var(--n-item-color-active-hover);")])]),re(null,mt)]),w("icon",`
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
 `),w("arrow",`
 grid-area: arrow;
 font-size: 16px;
 color: var(--n-arrow-color);
 transform: rotate(180deg);
 opacity: 1;
 transition:
 color .3s var(--n-bezier),
 transform 0.2s var(--n-bezier),
 opacity 0.2s var(--n-bezier);
 `),g("menu-item-content-header",`
 grid-area: content;
 transition:
 color .3s var(--n-bezier),
 opacity .3s var(--n-bezier);
 opacity: 1;
 white-space: nowrap;
 color: var(--n-item-text-color);
 `,[b("a",`
 outline: none;
 text-decoration: none;
 transition: color .3s var(--n-bezier);
 color: var(--n-item-text-color);
 `,[b("&::before",`
 content: "";
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),w("extra",`
 font-size: .93em;
 color: var(--n-group-text-color);
 transition: color .3s var(--n-bezier);
 `)])]),g("submenu",`
 cursor: pointer;
 position: relative;
 margin-top: 6px;
 `,[g("menu-item-content",`
 height: var(--n-item-height);
 `),g("submenu-children",`
 overflow: hidden;
 padding: 0;
 `,[bo({duration:".2s"})])]),g("menu-item-group",[g("menu-item-group-title",`
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
 `)])]),g("menu-tooltip",[b("a",`
 color: inherit;
 text-decoration: none;
 `)]),g("menu-divider",`
 transition: background-color .3s var(--n-bezier);
 background-color: var(--n-divider-color);
 height: 1px;
 margin: 6px 18px;
 `)]);function re(e,o){return[E("hover",e,o),b("&:hover",e,o)]}const Bt=B({name:"MenuOptionContent",props:{collapsed:Boolean,disabled:Boolean,title:[String,Function],icon:Function,extra:[String,Function],showArrow:Boolean,childActive:Boolean,hover:Boolean,paddingLeft:Number,selected:Boolean,maxIconSize:{type:Number,required:!0},activeIconSize:{type:Number,required:!0},iconMarginRight:{type:Number,required:!0},clsPrefix:{type:String,required:!0},onClick:Function,tmNode:{type:Object,required:!0},isEllipsisPlaceholder:Boolean},setup(e){const{props:o}=oe(ye);return{menuProps:o,style:y(()=>{const{paddingLeft:t}=e;return{paddingLeft:t&&`${t}px`}}),iconStyle:y(()=>{const{maxIconSize:t,activeIconSize:r,iconMarginRight:n}=e;return{width:`${t}px`,height:`${t}px`,fontSize:`${r}px`,marginRight:`${n}px`}})}},render(){const{clsPrefix:e,tmNode:o,menuProps:{renderIcon:t,renderLabel:r,renderExtra:n,expandIcon:l}}=this,a=t?t(o.rawNode):se(this.icon);return h("div",{onClick:f=>{var c;(c=this.onClick)===null||c===void 0||c.call(this,f)},role:"none",class:[`${e}-menu-item-content`,{[`${e}-menu-item-content--selected`]:this.selected,[`${e}-menu-item-content--collapsed`]:this.collapsed,[`${e}-menu-item-content--child-active`]:this.childActive,[`${e}-menu-item-content--disabled`]:this.disabled,[`${e}-menu-item-content--hover`]:this.hover}],style:this.style},a&&h("div",{class:`${e}-menu-item-content__icon`,style:this.iconStyle,role:"none"},[a]),h("div",{class:`${e}-menu-item-content-header`,role:"none"},this.isEllipsisPlaceholder?this.title:r?r(o.rawNode):se(this.title),this.extra||n?h("span",{class:`${e}-menu-item-content-header__extra`}," ",n?n(o.rawNode):se(this.extra)):null),this.showArrow?h($t,{ariaHidden:!0,class:`${e}-menu-item-content__arrow`,clsPrefix:e},{default:()=>l?l(o.rawNode):h(Xo,null)}):null)}}),Ce=8;function Ze(e){const o=oe(ye),{props:t,mergedCollapsedRef:r}=o,n=oe(Ot,null),l=oe(Qe,null),a=y(()=>t.mode==="horizontal"),f=y(()=>a.value?t.dropdownPlacement:"tmNodes"in e?"right-start":"right"),c=y(()=>{var u;return Math.max((u=t.collapsedIconSize)!==null&&u!==void 0?u:t.iconSize,t.iconSize)}),p=y(()=>{var u;return!a.value&&e.root&&r.value&&(u=t.collapsedIconSize)!==null&&u!==void 0?u:t.iconSize}),P=y(()=>{if(a.value)return;const{collapsedWidth:u,indent:v,rootIndent:x}=t,{root:S,isGroup:T}=e,L=x===void 0?v:x;return S?r.value?u/2-c.value/2:L:l&&typeof l.paddingLeftRef.value=="number"?v/2+l.paddingLeftRef.value:n&&typeof n.paddingLeftRef.value=="number"?(T?v/2:v)+n.paddingLeftRef.value:0}),_=y(()=>{const{collapsedWidth:u,indent:v,rootIndent:x}=t,{value:S}=c,{root:T}=e;return a.value||!T||!r.value?Ce:(x===void 0?v:x)+S+Ce-(u+S)/2});return{dropdownPlacement:f,activeIconSize:p,maxIconSize:c,paddingLeft:P,iconMarginRight:_,NMenu:o,NSubmenu:n,NMenuOptionGroup:l}}const et={internalKey:{type:[String,Number],required:!0},root:Boolean,isGroup:Boolean,level:{type:Number,required:!0},title:[String,Function],extra:[String,Function]},zr=B({name:"MenuDivider",setup(){const e=oe(ye),{mergedClsPrefixRef:o,isHorizontalRef:t}=e;return()=>t.value?null:h("div",{class:`${o.value}-menu-divider`})}}),At=Object.assign(Object.assign({},et),{tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function}),Sr=Ye(At),Ir=B({name:"MenuOption",props:At,setup(e){const o=Ze(e),{NSubmenu:t,NMenu:r,NMenuOptionGroup:n}=o,{props:l,mergedClsPrefixRef:a,mergedCollapsedRef:f}=r,c=t?t.mergedDisabledRef:n?n.mergedDisabledRef:{value:!1},p=y(()=>c.value||e.disabled);function P(u){const{onClick:v}=e;v&&v(u)}function _(u){p.value||(r.doSelect(e.internalKey,e.tmNode.rawNode),P(u))}return{mergedClsPrefix:a,dropdownPlacement:o.dropdownPlacement,paddingLeft:o.paddingLeft,iconMarginRight:o.iconMarginRight,maxIconSize:o.maxIconSize,activeIconSize:o.activeIconSize,mergedTheme:r.mergedThemeRef,menuProps:l,dropdownEnabled:Ke(()=>e.root&&f.value&&l.mode!=="horizontal"&&!p.value),selected:Ke(()=>r.mergedValueRef.value===e.internalKey),mergedDisabled:p,handleClick:_}},render(){const{mergedClsPrefix:e,mergedTheme:o,tmNode:t,menuProps:{renderLabel:r,nodeProps:n}}=this,l=n?.(t.rawNode);return h("div",Object.assign({},l,{role:"menuitem",class:[`${e}-menu-item`,l?.class]}),h(Vo,{theme:o.peers.Tooltip,themeOverrides:o.peerOverrides.Tooltip,trigger:"hover",placement:this.dropdownPlacement,disabled:!this.dropdownEnabled||this.title===void 0,internalExtraClass:["menu-tooltip"]},{default:()=>r?r(t.rawNode):se(this.title),trigger:()=>h(Bt,{tmNode:t,clsPrefix:e,paddingLeft:this.paddingLeft,iconMarginRight:this.iconMarginRight,maxIconSize:this.maxIconSize,activeIconSize:this.activeIconSize,selected:this.selected,title:this.title,extra:this.extra,disabled:this.mergedDisabled,icon:this.icon,onClick:this.handleClick})}))}}),Nt=Object.assign(Object.assign({},et),{tmNode:{type:Object,required:!0},tmNodes:{type:Array,required:!0}}),$r=Ye(Nt),Rr=B({name:"MenuOptionGroup",props:Nt,setup(e){const o=Ze(e),{NSubmenu:t}=o,r=y(()=>t?.mergedDisabledRef.value?!0:e.tmNode.disabled);Z(Qe,{paddingLeftRef:o.paddingLeft,mergedDisabledRef:r});const{mergedClsPrefixRef:n,props:l}=oe(ye);return function(){const{value:a}=n,f=o.paddingLeft.value,{nodeProps:c}=l,p=c?.(e.tmNode.rawNode);return h("div",{class:`${a}-menu-item-group`,role:"group"},h("div",Object.assign({},p,{class:[`${a}-menu-item-group-title`,p?.class],style:[p?.style||"",f!==void 0?`padding-left: ${f}px;`:""]}),se(e.title),e.extra?h(be,null," ",se(e.extra)):null),h("div",null,e.tmNodes.map(P=>tt(P,l))))}}});function Ue(e){return e.type==="divider"||e.type==="render"}function Mr(e){return e.type==="divider"}function tt(e,o){const{rawNode:t}=e,{show:r}=t;if(r===!1)return null;if(Ue(t))return Mr(t)?h(zr,Object.assign({key:e.key},t.props)):null;const{labelField:n}=o,{key:l,level:a,isGroup:f}=e,c=Object.assign(Object.assign({},t),{title:t.title||t[n],extra:t.titleExtra||t.extra,key:l,internalKey:l,level:a,root:a===0,isGroup:f});return e.children?e.isGroup?h(Rr,Ne(c,$r,{tmNode:e,tmNodes:e.children,key:l})):h(De,Ne(c,Tr,{key:l,rawNodes:t[o.childrenField],tmNodes:e.children,tmNode:e})):h(Ir,Ne(c,Sr,{key:l,tmNode:e}))}const Ht=Object.assign(Object.assign({},et),{rawNodes:{type:Array,default:()=>[]},tmNodes:{type:Array,default:()=>[]},tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function,domId:String,virtualChildActive:{type:Boolean,default:void 0},isEllipsisPlaceholder:Boolean}),Tr=Ye(Ht),De=B({name:"Submenu",props:Ht,setup(e){const o=Ze(e),{NMenu:t,NSubmenu:r}=o,{props:n,mergedCollapsedRef:l,mergedThemeRef:a}=t,f=y(()=>{const{disabled:u}=e;return r?.mergedDisabledRef.value||n.disabled?!0:u}),c=D(!1);Z(Ot,{paddingLeftRef:o.paddingLeft,mergedDisabledRef:f}),Z(Qe,null);function p(){const{onClick:u}=e;u&&u()}function P(){f.value||(l.value||t.toggleExpand(e.internalKey),p())}function _(u){c.value=u}return{menuProps:n,mergedTheme:a,doSelect:t.doSelect,inverted:t.invertedRef,isHorizontal:t.isHorizontalRef,mergedClsPrefix:t.mergedClsPrefixRef,maxIconSize:o.maxIconSize,activeIconSize:o.activeIconSize,iconMarginRight:o.iconMarginRight,dropdownPlacement:o.dropdownPlacement,dropdownShow:c,paddingLeft:o.paddingLeft,mergedDisabled:f,mergedValue:t.mergedValueRef,childActive:Ke(()=>{var u;return(u=e.virtualChildActive)!==null&&u!==void 0?u:t.activePathRef.value.includes(e.internalKey)}),collapsed:y(()=>n.mode==="horizontal"?!1:l.value?!0:!t.mergedExpandedKeysRef.value.includes(e.internalKey)),dropdownEnabled:y(()=>!f.value&&(n.mode==="horizontal"||l.value)),handlePopoverShowChange:_,handleClick:P}},render(){var e;const{mergedClsPrefix:o,menuProps:{renderIcon:t,renderLabel:r}}=this,n=()=>{const{isHorizontal:a,paddingLeft:f,collapsed:c,mergedDisabled:p,maxIconSize:P,activeIconSize:_,title:u,childActive:v,icon:x,handleClick:S,menuProps:{nodeProps:T},dropdownShow:L,iconMarginRight:J,tmNode:A,mergedClsPrefix:k,isEllipsisPlaceholder:$,extra:d}=this,m=T?.(A.rawNode);return h("div",Object.assign({},m,{class:[`${k}-menu-item`,m?.class],role:"menuitem"}),h(Bt,{tmNode:A,paddingLeft:f,collapsed:c,disabled:p,iconMarginRight:J,maxIconSize:P,activeIconSize:_,title:u,extra:d,showArrow:!a,childActive:v,clsPrefix:k,icon:x,hover:L,onClick:S,isEllipsisPlaceholder:$}))},l=()=>h(wo,null,{default:()=>{const{tmNodes:a,collapsed:f}=this;return f?null:h("div",{class:`${o}-submenu-children`,role:"menu"},a.map(c=>tt(c,this.menuProps)))}});return this.root?h(Ge,Object.assign({size:"large",trigger:"hover"},(e=this.menuProps)===null||e===void 0?void 0:e.dropdownProps,{themeOverrides:this.mergedTheme.peerOverrides.Dropdown,theme:this.mergedTheme.peers.Dropdown,builtinThemeOverrides:{fontSizeLarge:"14px",optionIconSizeLarge:"18px"},value:this.mergedValue,disabled:!this.dropdownEnabled,placement:this.dropdownPlacement,keyField:this.menuProps.keyField,labelField:this.menuProps.labelField,childrenField:this.menuProps.childrenField,onUpdateShow:this.handlePopoverShowChange,options:this.rawNodes,onSelect:this.doSelect,inverted:this.inverted,renderIcon:t,renderLabel:r}),{default:()=>h("div",{class:`${o}-submenu`,role:"menu","aria-expanded":!this.collapsed,id:this.domId},n(),this.isHorizontal?null:l())}):h("div",{class:`${o}-submenu`,role:"menu","aria-expanded":!this.collapsed,id:this.domId},n(),l())}}),Er=Object.assign(Object.assign({},te.props),{options:{type:Array,default:()=>[]},collapsed:{type:Boolean,default:void 0},collapsedWidth:{type:Number,default:48},iconSize:{type:Number,default:20},collapsedIconSize:{type:Number,default:24},rootIndent:Number,indent:{type:Number,default:32},labelField:{type:String,default:"label"},keyField:{type:String,default:"key"},childrenField:{type:String,default:"children"},disabledField:{type:String,default:"disabled"},defaultExpandAll:Boolean,defaultExpandedKeys:Array,expandedKeys:Array,value:[String,Number],defaultValue:{type:[String,Number],default:null},mode:{type:String,default:"vertical"},watchProps:{type:Array,default:void 0},disabled:Boolean,show:{type:Boolean,default:!0},inverted:Boolean,"onUpdate:expandedKeys":[Function,Array],onUpdateExpandedKeys:[Function,Array],onUpdateValue:[Function,Array],"onUpdate:value":[Function,Array],expandIcon:Function,renderIcon:Function,renderLabel:Function,renderExtra:Function,dropdownProps:Object,accordion:Boolean,nodeProps:Function,dropdownPlacement:{type:String,default:"bottom"},responsive:Boolean,items:Array,onOpenNamesChange:[Function,Array],onSelect:[Function,Array],onExpandedNamesChange:[Function,Array],expandedNames:Array,defaultExpandedNames:Array}),Pr=B({name:"Menu",inheritAttrs:!1,props:Er,setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:t}=ue(e),r=te("Menu","-menu",_r,Do,e,o),n=oe(Tt,null),l=y(()=>{var z;const{collapsed:O}=e;if(O!==void 0)return O;if(n){const{collapseModeRef:i,collapsedRef:M}=n;if(i.value==="width")return(z=M.value)!==null&&z!==void 0?z:!1}return!1}),a=y(()=>{const{keyField:z,childrenField:O,disabledField:i}=e;return He(e.items||e.options,{getIgnored(M){return Ue(M)},getChildren(M){return M[O]},getDisabled(M){return M[i]},getKey(M){var V;return(V=M[z])!==null&&V!==void 0?V:M.name}})}),f=y(()=>new Set(a.value.treeNodes.map(z=>z.key))),{watchProps:c}=e,p=D(null);c?.includes("defaultValue")?je(()=>{p.value=e.defaultValue}):p.value=e.defaultValue;const P=ce(e,"value"),_=fe(P,p),u=D([]),v=()=>{u.value=e.defaultExpandAll?a.value.getNonLeafKeys():e.defaultExpandedNames||e.defaultExpandedKeys||a.value.getPath(_.value,{includeSelf:!1}).keyPath};c?.includes("defaultExpandedKeys")?je(v):v();const x=Yo(e,["expandedNames","expandedKeys"]),S=fe(x,u),T=y(()=>a.value.treeNodes),L=y(()=>a.value.getPath(_.value).keyPath);Z(ye,{props:e,mergedCollapsedRef:l,mergedThemeRef:r,mergedValueRef:_,mergedExpandedKeysRef:S,activePathRef:L,mergedClsPrefixRef:o,isHorizontalRef:y(()=>e.mode==="horizontal"),invertedRef:ce(e,"inverted"),doSelect:J,toggleExpand:k});function J(z,O){const{"onUpdate:value":i,onUpdateValue:M,onSelect:V}=e;M&&X(M,z,O),i&&X(i,z,O),V&&X(V,z,O),p.value=z}function A(z){const{"onUpdate:expandedKeys":O,onUpdateExpandedKeys:i,onExpandedNamesChange:M,onOpenNamesChange:V}=e;O&&X(O,z),i&&X(i,z),M&&X(M,z),V&&X(V,z),u.value=z}function k(z){const O=Array.from(S.value),i=O.findIndex(M=>M===z);if(~i)O.splice(i,1);else{if(e.accordion&&f.value.has(z)){const M=O.findIndex(V=>f.value.has(V));M>-1&&O.splice(M,1)}O.push(z)}A(O)}const $=z=>{const O=a.value.getPath(z??_.value,{includeSelf:!1}).keyPath;if(!O.length)return;const i=Array.from(S.value),M=new Set([...i,...O]);e.accordion&&f.value.forEach(V=>{M.has(V)&&!O.includes(V)&&M.delete(V)}),A(Array.from(M))},d=y(()=>{const{inverted:z}=e,{common:{cubicBezierEaseInOut:O},self:i}=r.value,{borderRadius:M,borderColorHorizontal:V,fontSize:Pe,itemHeight:Oe,dividerColor:Be}=i,s={"--n-divider-color":Be,"--n-bezier":O,"--n-font-size":Pe,"--n-border-color-horizontal":V,"--n-border-radius":M,"--n-item-height":Oe};return z?(s["--n-group-text-color"]=i.groupTextColorInverted,s["--n-color"]=i.colorInverted,s["--n-item-text-color"]=i.itemTextColorInverted,s["--n-item-text-color-hover"]=i.itemTextColorHoverInverted,s["--n-item-text-color-active"]=i.itemTextColorActiveInverted,s["--n-item-text-color-child-active"]=i.itemTextColorChildActiveInverted,s["--n-item-text-color-child-active-hover"]=i.itemTextColorChildActiveInverted,s["--n-item-text-color-active-hover"]=i.itemTextColorActiveHoverInverted,s["--n-item-icon-color"]=i.itemIconColorInverted,s["--n-item-icon-color-hover"]=i.itemIconColorHoverInverted,s["--n-item-icon-color-active"]=i.itemIconColorActiveInverted,s["--n-item-icon-color-active-hover"]=i.itemIconColorActiveHoverInverted,s["--n-item-icon-color-child-active"]=i.itemIconColorChildActiveInverted,s["--n-item-icon-color-child-active-hover"]=i.itemIconColorChildActiveHoverInverted,s["--n-item-icon-color-collapsed"]=i.itemIconColorCollapsedInverted,s["--n-item-text-color-horizontal"]=i.itemTextColorHorizontalInverted,s["--n-item-text-color-hover-horizontal"]=i.itemTextColorHoverHorizontalInverted,s["--n-item-text-color-active-horizontal"]=i.itemTextColorActiveHorizontalInverted,s["--n-item-text-color-child-active-horizontal"]=i.itemTextColorChildActiveHorizontalInverted,s["--n-item-text-color-child-active-hover-horizontal"]=i.itemTextColorChildActiveHoverHorizontalInverted,s["--n-item-text-color-active-hover-horizontal"]=i.itemTextColorActiveHoverHorizontalInverted,s["--n-item-icon-color-horizontal"]=i.itemIconColorHorizontalInverted,s["--n-item-icon-color-hover-horizontal"]=i.itemIconColorHoverHorizontalInverted,s["--n-item-icon-color-active-horizontal"]=i.itemIconColorActiveHorizontalInverted,s["--n-item-icon-color-active-hover-horizontal"]=i.itemIconColorActiveHoverHorizontalInverted,s["--n-item-icon-color-child-active-horizontal"]=i.itemIconColorChildActiveHorizontalInverted,s["--n-item-icon-color-child-active-hover-horizontal"]=i.itemIconColorChildActiveHoverHorizontalInverted,s["--n-arrow-color"]=i.arrowColorInverted,s["--n-arrow-color-hover"]=i.arrowColorHoverInverted,s["--n-arrow-color-active"]=i.arrowColorActiveInverted,s["--n-arrow-color-active-hover"]=i.arrowColorActiveHoverInverted,s["--n-arrow-color-child-active"]=i.arrowColorChildActiveInverted,s["--n-arrow-color-child-active-hover"]=i.arrowColorChildActiveHoverInverted,s["--n-item-color-hover"]=i.itemColorHoverInverted,s["--n-item-color-active"]=i.itemColorActiveInverted,s["--n-item-color-active-hover"]=i.itemColorActiveHoverInverted,s["--n-item-color-active-collapsed"]=i.itemColorActiveCollapsedInverted):(s["--n-group-text-color"]=i.groupTextColor,s["--n-color"]=i.color,s["--n-item-text-color"]=i.itemTextColor,s["--n-item-text-color-hover"]=i.itemTextColorHover,s["--n-item-text-color-active"]=i.itemTextColorActive,s["--n-item-text-color-child-active"]=i.itemTextColorChildActive,s["--n-item-text-color-child-active-hover"]=i.itemTextColorChildActiveHover,s["--n-item-text-color-active-hover"]=i.itemTextColorActiveHover,s["--n-item-icon-color"]=i.itemIconColor,s["--n-item-icon-color-hover"]=i.itemIconColorHover,s["--n-item-icon-color-active"]=i.itemIconColorActive,s["--n-item-icon-color-active-hover"]=i.itemIconColorActiveHover,s["--n-item-icon-color-child-active"]=i.itemIconColorChildActive,s["--n-item-icon-color-child-active-hover"]=i.itemIconColorChildActiveHover,s["--n-item-icon-color-collapsed"]=i.itemIconColorCollapsed,s["--n-item-text-color-horizontal"]=i.itemTextColorHorizontal,s["--n-item-text-color-hover-horizontal"]=i.itemTextColorHoverHorizontal,s["--n-item-text-color-active-horizontal"]=i.itemTextColorActiveHorizontal,s["--n-item-text-color-child-active-horizontal"]=i.itemTextColorChildActiveHorizontal,s["--n-item-text-color-child-active-hover-horizontal"]=i.itemTextColorChildActiveHoverHorizontal,s["--n-item-text-color-active-hover-horizontal"]=i.itemTextColorActiveHoverHorizontal,s["--n-item-icon-color-horizontal"]=i.itemIconColorHorizontal,s["--n-item-icon-color-hover-horizontal"]=i.itemIconColorHoverHorizontal,s["--n-item-icon-color-active-horizontal"]=i.itemIconColorActiveHorizontal,s["--n-item-icon-color-active-hover-horizontal"]=i.itemIconColorActiveHoverHorizontal,s["--n-item-icon-color-child-active-horizontal"]=i.itemIconColorChildActiveHorizontal,s["--n-item-icon-color-child-active-hover-horizontal"]=i.itemIconColorChildActiveHoverHorizontal,s["--n-arrow-color"]=i.arrowColor,s["--n-arrow-color-hover"]=i.arrowColorHover,s["--n-arrow-color-active"]=i.arrowColorActive,s["--n-arrow-color-active-hover"]=i.arrowColorActiveHover,s["--n-arrow-color-child-active"]=i.arrowColorChildActive,s["--n-arrow-color-child-active-hover"]=i.arrowColorChildActiveHover,s["--n-item-color-hover"]=i.itemColorHover,s["--n-item-color-active"]=i.itemColorActive,s["--n-item-color-active-hover"]=i.itemColorActiveHover,s["--n-item-color-active-collapsed"]=i.itemColorActiveCollapsed),s}),m=t?we("menu",y(()=>e.inverted?"a":"b"),d,e):void 0,H=yo(),R=D(null),W=D(null);let F=!0;const q=()=>{var z;F?F=!1:(z=R.value)===null||z===void 0||z.sync({showAllItemsBeforeCalculate:!0})};function Y(){return document.getElementById(H)}const ie=D(-1);function Ie(z){ie.value=e.options.length-z}function $e(z){z||(ie.value=-1)}const Re=y(()=>{const z=ie.value;return{children:z===-1?[]:e.options.slice(z)}}),Me=y(()=>{const{childrenField:z,disabledField:O,keyField:i}=e;return He([Re.value],{getIgnored(M){return Ue(M)},getChildren(M){return M[z]},getDisabled(M){return M[O]},getKey(M){var V;return(V=M[i])!==null&&V!==void 0?V:M.name}})}),Te=y(()=>He([{}]).treeNodes[0]);function Ee(){var z;if(ie.value===-1)return h(De,{root:!0,level:0,key:"__ellpisisGroupPlaceholder__",internalKey:"__ellpisisGroupPlaceholder__",title:"···",tmNode:Te.value,domId:H,isEllipsisPlaceholder:!0});const O=Me.value.treeNodes[0],i=L.value,M=!!(!((z=O.children)===null||z===void 0)&&z.some(V=>i.includes(V.key)));return h(De,{level:0,root:!0,key:"__ellpisisGroup__",internalKey:"__ellpisisGroup__",title:"···",virtualChildActive:M,tmNode:O,domId:H,rawNodes:O.rawNode.children||[],tmNodes:O.children||[],isEllipsisPlaceholder:!0})}return{mergedClsPrefix:o,controlledExpandedKeys:x,uncontrolledExpanededKeys:u,mergedExpandedKeys:S,uncontrolledValue:p,mergedValue:_,activePath:L,tmNodes:T,mergedTheme:r,mergedCollapsed:l,cssVars:t?void 0:d,themeClass:m?.themeClass,overflowRef:R,counterRef:W,updateCounter:()=>{},onResize:q,onUpdateOverflow:$e,onUpdateCount:Ie,renderCounter:Ee,getCounter:Y,onRender:m?.onRender,showOption:$,deriveResponsiveState:q}},render(){const{mergedClsPrefix:e,mode:o,themeClass:t,onRender:r}=this;r?.();const n=()=>this.tmNodes.map(c=>tt(c,this.$props)),a=o==="horizontal"&&this.responsive,f=()=>h("div",kt(this.$attrs,{role:o==="horizontal"?"menubar":"menu",class:[`${e}-menu`,t,`${e}-menu--${o}`,a&&`${e}-menu--responsive`,this.mergedCollapsed&&`${e}-menu--collapsed`],style:this.cssVars}),a?h(Wo,{ref:"overflowRef",onUpdateOverflow:this.onUpdateOverflow,getCounter:this.getCounter,onUpdateCount:this.onUpdateCount,updateCounter:this.updateCounter,style:{width:"100%",display:"flex",overflow:"hidden"}},{default:n,counter:this.renderCounter}):n());return a?h(xo,{onResize:this.onResize},{default:f}):f()}}),Or={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Br=B({name:"CalendarOutline",render:function(o,t){return N(),K("svg",Or,t[0]||(t[0]=[Ve('<rect fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" x="48" y="80" width="416" height="384" rx="48"></rect><circle cx="296" cy="232" r="24" fill="currentColor"></circle><circle cx="376" cy="232" r="24" fill="currentColor"></circle><circle cx="296" cy="312" r="24" fill="currentColor"></circle><circle cx="376" cy="312" r="24" fill="currentColor"></circle><circle cx="136" cy="312" r="24" fill="currentColor"></circle><circle cx="216" cy="312" r="24" fill="currentColor"></circle><circle cx="136" cy="392" r="24" fill="currentColor"></circle><circle cx="216" cy="392" r="24" fill="currentColor"></circle><circle cx="296" cy="392" r="24" fill="currentColor"></circle><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" stroke-linecap="round" d="M128 48v32"></path><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" stroke-linecap="round" d="M384 48v32"></path><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" d="M464 160H48"></path>',13)]))}}),Ar={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},ot=B({name:"CheckmarkOutline",render:function(o,t){return N(),K("svg",Ar,t[0]||(t[0]=[C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M416 128L192 384l-96-96"},null,-1)]))}}),Nr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Hr=B({name:"CloseOutline",render:function(o,t){return N(),K("svg",Nr,t[0]||(t[0]=[C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M368 368L144 144"},null,-1),C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M368 144L144 368"},null,-1)]))}}),Lr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Fr=B({name:"ContrastOutline",render:function(o,t){return N(),K("svg",Lr,t[0]||(t[0]=[C("circle",{cx:"256",cy:"256",r:"208",fill:"none",stroke:"currentColor","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("path",{d:"M256 464c-114.88 0-208-93.12-208-208S141.12 48 256 48z",fill:"currentColor"},null,-1)]))}}),jr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Kr=B({name:"EllipsisHorizontal",render:function(o,t){return N(),K("svg",jr,t[0]||(t[0]=[C("circle",{cx:"256",cy:"256",r:"48",fill:"currentColor"},null,-1),C("circle",{cx:"416",cy:"256",r:"48",fill:"currentColor"},null,-1),C("circle",{cx:"96",cy:"256",r:"48",fill:"currentColor"},null,-1)]))}}),Ur={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},ft=B({name:"FolderOpenOutline",render:function(o,t){return N(),K("svg",Ur,t[0]||(t[0]=[C("path",{d:"M64 192v-72a40 40 0 0 1 40-40h75.89a40 40 0 0 1 22.19 6.72l27.84 18.56a40 40 0 0 0 22.19 6.72H408a40 40 0 0 1 40 40v40",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("path",{d:"M479.9 226.55L463.68 392a40 40 0 0 1-39.93 40H88.25a40 40 0 0 1-39.93-40L32.1 226.55A32 32 0 0 1 64 192h384.1a32 32 0 0 1 31.8 34.55z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),Dr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Vr=B({name:"GridOutline",render:function(o,t){return N(),K("svg",Dr,t[0]||(t[0]=[C("rect",{x:"48",y:"48",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("rect",{x:"288",y:"48",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("rect",{x:"48",y:"288",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("rect",{x:"288",y:"288",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),Wr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Yr=B({name:"LayersOutline",render:function(o,t){return N(),K("svg",Wr,t[0]||(t[0]=[C("path",{d:"M434.8 137.65l-149.36-68.1c-16.19-7.4-42.69-7.4-58.88 0L77.3 137.65c-17.6 8-17.6 21.09 0 29.09l148 67.5c16.89 7.7 44.69 7.7 61.58 0l148-67.5c17.52-8 17.52-21.1-.08-29.09z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("path",{d:"M160 308.52l-82.7 37.11c-17.6 8-17.6 21.1 0 29.1l148 67.5c16.89 7.69 44.69 7.69 61.58 0l148-67.5c17.6-8 17.6-21.1 0-29.1l-79.94-38.47",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("path",{d:"M160 204.48l-82.8 37.16c-17.6 8-17.6 21.1 0 29.1l148 67.49c16.89 7.7 44.69 7.7 61.58 0l148-67.49c17.7-8 17.7-21.1.1-29.1L352 204.48",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),Xr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Gr=B({name:"LibraryOutline",render:function(o,t){return N(),K("svg",Xr,t[0]||(t[0]=[Ve('<rect x="32" y="96" width="64" height="368" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 224h128"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 400h128"></path><rect x="112" y="160" width="128" height="304" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><rect x="256" y="48" width="96" height="416" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><path d="M422.46 96.11l-40.4 4.25c-11.12 1.17-19.18 11.57-17.93 23.1l34.92 321.59c1.26 11.53 11.37 20 22.49 18.84l40.4-4.25c11.12-1.17 19.18-11.57 17.93-23.1L445 115c-1.31-11.58-11.42-20.06-22.54-18.89z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></path>',6)]))}}),qr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Jr=B({name:"LogOutOutline",render:function(o,t){return N(),K("svg",qr,t[0]||(t[0]=[C("path",{d:"M304 336v40a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V136a40 40 0 0 1 40-40h152c22.09 0 48 17.91 48 40v40",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M368 336l80-80l-80-80"},null,-1),C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M176 256h256"},null,-1)]))}}),Qr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Zr=B({name:"MenuOutline",render:function(o,t){return N(),K("svg",Qr,t[0]||(t[0]=[C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 160h352"},null,-1),C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 256h352"},null,-1),C("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 352h352"},null,-1)]))}}),en={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Lt=B({name:"MoonOutline",render:function(o,t){return N(),K("svg",en,t[0]||(t[0]=[C("path",{d:"M160 136c0-30.62 4.51-61.61 16-88C99.57 81.27 48 159.32 48 248c0 119.29 96.71 216 216 216c88.68 0 166.73-51.57 200-128c-26.39 11.49-57.38 16-88 16c-119.29 0-216-96.71-216-216z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),tn={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},on=B({name:"PersonCircleOutline",render:function(o,t){return N(),K("svg",tn,t[0]||(t[0]=[C("path",{d:"M258.9 48C141.92 46.42 46.42 141.92 48 258.9c1.56 112.19 92.91 203.54 205.1 205.1c117 1.6 212.48-93.9 210.88-210.88C462.44 140.91 371.09 49.56 258.9 48zm126.42 327.25a4 4 0 0 1-6.14-.32a124.27 124.27 0 0 0-32.35-29.59C321.37 329 289.11 320 256 320s-65.37 9-90.83 25.34a124.24 124.24 0 0 0-32.35 29.58a4 4 0 0 1-6.14.32A175.32 175.32 0 0 1 80 259c-1.63-97.31 78.22-178.76 175.57-179S432 158.81 432 256a175.32 175.32 0 0 1-46.68 119.25z",fill:"currentColor"},null,-1),C("path",{d:"M256 144c-19.72 0-37.55 7.39-50.22 20.82s-19 32-17.57 51.93C191.11 256 221.52 288 256 288s64.83-32 67.79-71.24c1.48-19.74-4.8-38.14-17.68-51.82C293.39 151.44 275.59 144 256 144z",fill:"currentColor"},null,-1)]))}}),rn={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},gt=B({name:"ServerOutline",render:function(o,t){return N(),K("svg",rn,t[0]||(t[0]=[C("ellipse",{cx:"256",cy:"128",rx:"192",ry:"80",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32"},null,-1),C("path",{d:"M448 214c0 44.18-86 80-192 80S64 258.18 64 214",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32"},null,-1),C("path",{d:"M448 300c0 44.18-86 80-192 80S64 344.18 64 300",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32"},null,-1),C("path",{d:"M64 127.24v257.52C64 428.52 150 464 256 464s192-35.48 192-79.24V127.24",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32"},null,-1)]))}}),nn={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Ft=B({name:"SettingsOutline",render:function(o,t){return N(),K("svg",nn,t[0]||(t[0]=[C("path",{d:"M262.29 192.31a64 64 0 1 0 57.4 57.4a64.13 64.13 0 0 0-57.4-57.4zM416.39 256a154.34 154.34 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.48 164.48 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22a155.3 155.3 0 0 1-21.46-12.57a16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.48 164.48 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22a155.3 155.3 0 0 1 21.46 12.57a16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0-6.05 14.08c.33 4.14.55 8.3.55 12.47z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),ln={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},jt=B({name:"SunnyOutline",render:function(o,t){return N(),K("svg",ln,t[0]||(t[0]=[Ve('<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 48v48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 416v48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 108.92l-33.94 33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 369.14l-33.94 33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M464 256h-48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M96 256H48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 403.08l-33.94-33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 142.86l-33.94-33.94"></path><circle cx="256" cy="256" r="80" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"></circle>',9)]))}}),ae=e=>()=>h(pe,null,{default:()=>h(e)});function an(e){const o=(l,a,f)=>({label:()=>h(qt,{to:{name:a},onClick:e.onNavigate},{default:()=>l}),key:a,...f?{icon:ae(f)}:{}}),t=new Set(Co(e.can)),n=[{key:"dashboard",build:()=>o("工作台","dashboard",Vr)},{key:"memos",build:()=>o("备忘录","memos",Eo)},{key:"warehouse",build:()=>({label:"二级库 Pro",key:"warehouse-group",icon:ae(ht),children:[o("库存查询","stock"),o("物资档案","stock-materials"),o("操作记录","operations"),...e.can("warehouse:write")?[o("入库","inbound"),o("出库","outbound")]:[]]})},{key:"warehouse_lite",build:()=>o("二级库 Lite","warehouse-lite",ht)},{key:"huaxing_inventory",build:()=>o("华星总库存","hua-xing-stock",Yr)},{key:"procurement",build:()=>({label:"申购管理",key:"procurement-group",icon:ae(Po),children:[o("申购计划","purchase-materials"),o("周期性计划","purchase-plan-templates"),o("未编码物资","uncoded-materials"),o("物料编码库","material-code-library"),o("申购记录","purchase-records")]})},{key:"hazards",build:()=>({label:"隐患管理",key:"hazard-group",icon:ae(Oo),children:[o("隐患管理","hazard-records"),o("隐患类型","hazard-types"),o("责任单位","hazard-units")]})},{key:"ledger",build:()=>({label:"台账管理",key:"ledger-group",icon:ae(Gr),children:[o("台账总览","ledger-items"),o("标签管理","ledger-tags")]})},{key:"work",build:()=>o("工作管理","work-tasks",Br)}].filter(l=>t.has(l.key)).map(l=>l.build());return e.can("system:admin")&&n.push({label:"系统管理",key:"settings-group",icon:ae(Ft),children:[o("用户管理","users"),o("项目管理","projects"),o("附件管理","attachments"),o("高级设置","advanced-settings"),o("分享链接","share-links"),o("关于","about")]}),n}const rt=8;function sn(e,o,t=rt){const r=e.findIndex(l=>l.key===o.key),n=e.slice();if(r>=0)return n[r]={...n[r],...o},n;for(n.push(o);n.length>t;)n.shift();return n}function Kt(e,o){return e.filter(t=>t.key!==o)}function cn(e,o,t){if(t!==o)return t;const r=e.findIndex(l=>l.key===o),n=Kt(e,o);return n.length?(e[r+1]??e[r-1]??n[n.length-1]).key:null}function dn(e,o){const t=new Set(o.map(r=>r.key));return e.filter(r=>!t.has(r.key)).map(r=>r.key)}const Ut="app.tabs.v1";function nt(e){return!!e.meta.title&&!e.meta.public&&!e.meta.noTab}function un(){try{const e=sessionStorage.getItem(Ut);if(!e)return[];const o=JSON.parse(e);return Array.isArray(o)?o.filter(t=>!!t&&typeof t.key=="string"&&typeof t.title=="string"&&typeof t.path=="string"):[]}catch{return[]}}const G=D(un()),ee=D(null),ke=D({});ge(G,e=>{try{sessionStorage.setItem(Ut,JSON.stringify(e))}catch{}},{deep:!0});function hn(e){return`${e}#${ke.value[e]??0}`}function de(e){ke.value={...ke.value,[e]:(ke.value[e]??0)+1}}function Dt(e){if(!nt(e)||typeof e.name!="string"){ee.value=null;return}const o=G.value;G.value=sn(o,{key:e.name,title:String(e.meta.title??e.name),path:e.fullPath}),ee.value=e.name;for(const t of dn(o,G.value))de(t)}function Le(e,o){const t=G.value.find(r=>r.key===o);if(t){if(t.path===e.currentRoute.value.fullPath){ee.value=o;return}e.push(t.path)}}function bt(e,o){if(G.value.length<=1)return;const t=cn(G.value,o,ee.value),r=G.value.find(l=>l.key===t),n=t===ee.value;if(G.value=Kt(G.value,o),n){de(o);return}ee.value=t,(r?e.push(r.path):Promise.resolve()).finally(()=>de(o))}function vn(){const e=ee.value,o=G.value.filter(t=>t.key!==e);if(o.length){G.value=G.value.filter(t=>t.key===e);for(const t of o)de(t.key)}}function mn(e){const o=G.value.map(r=>r.key);if(!o.length)return;const t=o.includes(String(e.currentRoute.value.name??""));G.value=[],ee.value=null;for(const r of o)de(r);t&&e.replace("/").finally(()=>Dt(e.currentRoute.value))}function pn(){for(const e of G.value)de(e.key);G.value=[],ee.value=null}function Vt(){return{tabs:G,activeKey:ee,max:rt,tabCacheKey:hn}}const fn={class:"app-tabs",role:"tablist","aria-label":"已打开的页面"},gn={type:"button",class:"app-tabs-more","aria-label":"标签页操作"},bn=["aria-selected","title","onClick","onKeydown","onAuxclick"],wn={class:"app-tab-label"},xn=["aria-label","onClick"],yn=["title"],Cn={class:"app-tab-label"},kn=B({__name:"AppTabs",setup(e){const o=_t(),t=zt(),{tabs:r,activeKey:n}=Vt();ge(()=>o.fullPath,()=>Dt(o),{immediate:!0});const l=y(()=>{if(nt(o))return null;const p=o.meta.title;return typeof p=="string"&&p?p:null});function a(p,P){p.button===1&&(p.preventDefault(),bt(t,P))}const f=y(()=>[{label:"关闭其他标签页",key:"others",disabled:r.value.length<=1},{label:"关闭所有标签页",key:"all",disabled:r.value.length===0}]);function c(p){p==="others"?vn():p==="all"&&mn(t)}return(p,P)=>{const _=pe,u=Ge;return N(),K("div",fn,[I(u,{trigger:"click",options:f.value,onSelect:c},{default:j(()=>[C("button",gn,[I(_,{size:16},{default:j(()=>[I(U(Kr))]),_:1})])]),_:1},8,["options"]),(N(!0),K(be,null,Jt(U(r),v=>(N(),K("div",{key:v.key,class:_e(["app-tab",{"is-active":v.key===U(n)}]),role:"tab","aria-selected":v.key===U(n),title:v.title,tabindex:"0",onClick:x=>U(Le)(U(t),v.key),onKeydown:[st(Ae(x=>U(Le)(U(t),v.key),["prevent"]),["enter"]),st(Ae(x=>U(Le)(U(t),v.key),["prevent"]),["space"])],onAuxclick:x=>a(x,v.key)},[C("span",wn,ne(v.title),1),U(r).length>1?(N(),K("button",{key:0,type:"button",class:"app-tab-close","aria-label":`关闭 ${v.title}`,onClick:Ae(x=>U(bt)(U(t),v.key),["stop"])},[I(_,{size:12},{default:j(()=>[I(U(Hr))]),_:1})],8,xn)):Q("",!0)],42,bn))),128)),l.value?(N(),K("div",{key:0,class:"app-tab app-tab--current is-active",title:l.value,"aria-current":"page"},[C("span",Cn,ne(l.value),1)],8,yn)):Q("",!0)])}}}),_n=Se(kn,[["__scopeId","data-v-9ce1be8f"]]),zn={class:"account-summary"},Sn={class:"account-name"},In={class:"account-meta"},$n=B({__name:"AccountSettingsModal",props:{show:{type:Boolean}},emits:["update:show"],setup(e,{emit:o}){const t=e,r=o,n=Xe(),l=Rt(),a=Lo(),f=y({get:()=>t.show,set:A=>r("update:show",A)}),c=D(null),p=D(!1),P=D(!1),_=Qt({current_password:"",new_password:"",confirm_password:""}),u=y(()=>n.user),v=y(()=>{const A=c.value?.api_token;return A?zo(So(),A,l.currentProjectId):""}),x=y(()=>c.value?.api_token?c.value.api_token:p.value?"正在加载…":c.value?"（旧版令牌无法回显，请联系管理员重新生成）":"（暂不可用）");function S(){_.current_password="",_.new_password="",_.confirm_password=""}async function T(){p.value=!0;try{c.value=await ut.myApiToken()}catch(A){a.error(A instanceof Error?A.message:"MCP 令牌加载失败")}finally{p.value=!1}}async function L(A,k){if(A)try{await navigator.clipboard.writeText(A),a.success(`${k}已复制`)}catch{a.error(`复制失败，请手动选择${k}`)}}async function J(){if(!_.new_password||_.new_password.length<6){a.error("新密码至少 6 位");return}if(_.new_password!==_.confirm_password){a.error("两次输入的新密码不一致");return}P.value=!0;try{await ut.changeMyPassword({..._.current_password?{current_password:_.current_password}:{},new_password:_.new_password}),S(),a.success("密码已修改，下次登录请使用新密码"),n.refresh().catch(()=>{})}catch(A){a.error(A instanceof Error?A.message:"密码修改失败")}finally{P.value=!1}}return ge(()=>t.show,A=>{if(!A){c.value=null,S();return}S(),T()}),(A,k)=>{const $=jo,d=Ko,m=_o,H=Ao,R=No,W=Fo,F=Ho,q=ko;return N(),ve(q,{show:f.value,"onUpdate:show":k[6]||(k[6]=Y=>f.value=Y),preset:"card",title:"用户设置",style:{width:"min(540px, calc(100vw - 32px))"}},{footer:j(()=>[I(F,{justify:"end"},{default:j(()=>[I(m,{onClick:k[5]||(k[5]=Y=>f.value=!1)},{default:j(()=>[...k[12]||(k[12]=[le("关闭",-1)])]),_:1}),I(m,{type:"primary",loading:P.value,onClick:J},{default:j(()=>[...k[13]||(k[13]=[le("修改密码",-1)])]),_:1},8,["loading"])]),_:1})]),default:j(()=>[I(W,{"label-placement":"top",size:"small","show-feedback":!1},{default:j(()=>[I($,{label:"账号"},{default:j(()=>[C("div",zn,[C("span",Sn,ne(u.value?.display_name||u.value?.username||"—"),1),C("span",In,[le(" @"+ne(u.value?.username||"—")+" ",1),u.value?.department_name?(N(),K(be,{key:0},[le(" · "+ne(u.value.department_name),1)],64)):Q("",!0)]),k[7]||(k[7]=C("span",{class:"account-hint"},"个人资料由管理员维护，这里只能修改密码。",-1))])]),_:1}),I($,{label:"MCP 地址"},{default:j(()=>[I(H,null,{default:j(()=>[I(d,{value:v.value||"（令牌加载后生成）",readonly:""},null,8,["value"]),I(m,{disabled:!v.value,onClick:k[0]||(k[0]=Y=>L(v.value,"MCP 地址"))},{default:j(()=>[...k[8]||(k[8]=[le("复制地址",-1)])]),_:1},8,["disabled"])]),_:1})]),_:1}),I($,{label:"MCP 令牌"},{default:j(()=>[I(H,null,{default:j(()=>[I(d,{value:x.value,readonly:""},null,8,["value"]),I(m,{disabled:!c.value?.api_token,onClick:k[1]||(k[1]=Y=>L(c.value?.api_token??"","MCP 令牌"))},{default:j(()=>[...k[9]||(k[9]=[le(" 复制令牌 ",-1)])]),_:1},8,["disabled"])]),_:1})]),_:1}),k[10]||(k[10]=C("p",{class:"dialog-hint token-hint"},"MCP 地址已包含令牌，请勿公开分享；令牌仅供本人使用。",-1)),I(R),k[11]||(k[11]=C("div",{class:"dialog-section-title"},"修改密码",-1)),I($,{label:"当前密码"},{default:j(()=>[I(d,{value:_.current_password,"onUpdate:value":k[2]||(k[2]=Y=>_.current_password=Y),type:"password","show-password-on":"click",placeholder:"未设置过密码的账号可留空"},null,8,["value"])]),_:1}),I($,{label:"新密码"},{default:j(()=>[I(d,{value:_.new_password,"onUpdate:value":k[3]||(k[3]=Y=>_.new_password=Y),type:"password","show-password-on":"click",placeholder:"至少 6 位"},null,8,["value"])]),_:1}),I($,{label:"确认新密码"},{default:j(()=>[I(d,{value:_.confirm_password,"onUpdate:value":k[4]||(k[4]=Y=>_.confirm_password=Y),type:"password","show-password-on":"click",placeholder:"再次输入新密码"},null,8,["value"])]),_:1})]),_:1})]),_:1},8,["show"])}}}),Rn=Se($n,[["__scopeId","data-v-06c19e6c"]]),Mn={auto:"自动",light:"浅色",dark:"深色"},Tn={auto:Fr,light:jt,dark:Lt},En="外观",Pn="theme-menu";function On(e){return Mt.includes(e)}function Bn(e,o,t){return[{label:En,key:Pn,icon:t(o?Lt:jt),children:Mt.map(r=>({key:r,label:Mn[r],icon:t(r===e?ot:Tn[r])}))}]}const An="backend-menu",Nn="线路：",it="backend:";function Wt(e){return e.startsWith(it)}function Hn(e){if(!Wt(e))return null;const o=Number(e.slice(it.length));return Number.isInteger(o)&&o>=0?o:null}function wt(e,o){try{const t=new URL(e,o),r=t.origin===o?"本站":t.host,n=t.pathname.replace(/\/+$/,"")||"/";return n==="/api/v1"?r:`${r}${n}`}catch{return e}}function Ln(e,o,t,r=window.location.origin){if(e.length<2)return[];const n=e[o]??e[0];return[{label:`${Nn}${wt(n,r)}`,key:An,icon:t(gt),children:e.map((l,a)=>({key:`${it}${a}`,label:wt(l,r),icon:t(a===o?ot:gt)}))}]}const Fn="project-menu",jn="项目：",lt="project:",Kn="project:none",Un="暂无可用项目";function Yt(e){return e.startsWith(lt)}function Dn(e){if(!Yt(e))return null;const o=Number(e.slice(lt.length));return Number.isInteger(o)&&o>0?o:null}function xt(e){return e.name?.trim()||"未命名项目"}function Vn(e,o,t){const r=e.find(n=>n.id===o)??null;return[{label:`${jn}${r?xt(r):"未选择"}`,key:Fn,icon:t(ft),children:e.length?e.map(n=>({key:`${lt}${n.id}`,label:xt(n),icon:t(n.id===o?ot:ft)})):[{key:Kn,label:Un,disabled:!0}]}]}const Wn={class:"user-menu-icon","aria-hidden":"true"},Yn={key:0,class:"user-summary"},Xn={class:"user-name"},Gn={class:"user-role"},qn={key:1,class:"user-menu-caret","aria-hidden":"true"},Jn=B({__name:"UserMenu",props:{collapsed:{type:Boolean},zIndex:{}},setup(e){const o=zt(),t=Xe(),r=Rt(),n=Io(),l=D(!1),a=u=>()=>h(pe,null,{default:()=>h(u)}),f=y(()=>t.user?.display_name||t.user?.username||"未登录"),c=y(()=>{const u=t.user?.permissions??[];if(u.length===0)return"未分配权限";if(u.includes("system:admin"))return"系统管理";const v=[["warehouse","二级库 Pro"],["lite","二级库 Lite"],["purchase","申购"],["huaxing","华星"],["codes","编码库"],["ledger","台账"],["hazard","隐患"],["work","工作管理"]],x=v.filter(([T])=>u.includes(`${T}:write`));return x.length>0?x.map(([,T])=>`${T}读写`).join(" / "):v.filter(([T])=>u.includes(`${T}:read`)).length>0?"只读":"未分配权限"}),p=y(()=>[...Bn(n.mode,n.isDark,a),...Vn(r.enabledProjects,r.currentProject?.id??null,a),...Ln(Mo(),Ro(),a),{type:"divider",key:"account-divider"},{label:"用户设置",key:"account-settings",icon:a(Ft)},{label:"退出登录",key:"logout",icon:a(Jr)}]);function P(u){if(u==="account-settings"){l.value=!0;return}if(u==="logout"){_();return}if(On(u)){n.setMode(u);return}if(Yt(u)){const v=Dn(u);v!==null&&r.select(v);return}if(Wt(u)){const v=Hn(u);v!==null&&$o(v)&&location.reload()}}function _(){t.logout(),r.clear(),pn(),o.push({name:"login"})}return(u,v)=>{const x=Ge;return N(),K(be,null,[I(x,{options:p.value,"z-index":e.zIndex,placement:"top-start",trigger:"click",onSelect:P},{default:j(()=>[C("button",{type:"button",class:_e(["user-menu-trigger",{compact:e.collapsed}]),"aria-label":"打开用户菜单"},[C("span",Wn,[I(U(pe),{size:18},{default:j(()=>[I(U(on))]),_:1})]),e.collapsed?Q("",!0):(N(),K("span",Yn,[C("span",Xn,ne(f.value),1),C("span",Gn,ne(c.value),1)])),e.collapsed?Q("",!0):(N(),K("span",qn))],2)]),_:1},8,["options","z-index"]),I(Rn,{show:l.value,"onUpdate:show":v[0]||(v[0]=S=>l.value=S)},null,8,["show"])],64)}}}),yt=Se(Jn,[["__scopeId","data-v-003ae4a3"]]);function Qn(e,o){const t=o.filter(r=>!e.includes(r));return t.length?[t[t.length-1]]:o.slice(-1)}function Zn(e,o){if(!o)return null;for(const t of e)if(t.children?.some(r=>String(r.key)===o))return t.key==null?null:String(t.key);return null}const ei=["src"],ti={key:0},oi={class:"sider-user"},ri={class:"drawer-brand"},ni=["src"],ii={class:"drawer-user"},li=B({__name:"AppLayout",setup(e){const o=_t(),t=Xe(),r=D(!1),n=To("(max-width: 768px)"),l=D(!1),a=()=>{l.value=!1},{tabCacheKey:f}=Vt();function c(v){return nt(v)&&typeof v.name=="string"}const p=y(()=>an({can:v=>t.can(v),onNavigate:a})),P=D([]);function _(v){P.value=Qn(P.value,v)}ge(()=>o.name,v=>{const x=Zn(p.value,typeof v=="string"?v:null);x&&(P.value=[x])},{immediate:!0});const u={display:"flex",flexDirection:"column",overflow:"hidden"};return(v,x)=>{const S=Pr,T=kr,L=pe,J=br,A=eo("router-view"),k=pr,$=mr,d=dr;return N(),K(be,null,[I($,{"has-sider":!U(n),class:"app-shell"},{default:j(()=>[U(n)?Q("",!0):(N(),ve(T,{key:0,bordered:"","collapse-mode":"width","collapsed-width":64,width:180,collapsed:r.value,"content-style":u,"show-trigger":"",onCollapse:x[0]||(x[0]=m=>r.value=!0),onExpand:x[1]||(x[1]=m=>r.value=!1)},{default:j(()=>[C("div",{class:_e(["brand",{compact:r.value}])},[C("img",{class:"brand-mark",src:U(vt),alt:"系统 Logo"},null,8,ei),r.value?Q("",!0):(N(),K("span",ti,"HXNI 电气无忧"))],2),I(S,{class:"sider-menu",collapsed:r.value,"collapsed-width":64,"icon-size":16,"collapsed-icon-size":18,options:p.value,value:String(U(o).name||""),"expanded-keys":P.value,"onUpdate:expandedKeys":_},null,8,["collapsed","options","value","expanded-keys"]),C("div",oi,[I(yt,{collapsed:r.value},null,8,["collapsed"])])]),_:1},8,["collapsed"])),I($,null,{default:j(()=>[I(J,{bordered:"",class:_e(["app-topbar",{"is-mobile":U(n)}])},{default:j(()=>[U(n)?(N(),K("button",{key:0,type:"button",class:"menu-toggle","aria-label":"打开导航菜单",onClick:x[2]||(x[2]=m=>l.value=!0)},[I(L,{size:18},{default:j(()=>[I(U(Zr))]),_:1})])):Q("",!0),I(_n)]),_:1},8,["class"]),I(k,{class:"app-content","native-scrollbar":!1},{default:j(()=>[I(A,null,{default:j(({Component:m,route:H})=>[(N(),ve(Zt,{max:U(rt)},[c(H)?(N(),ve(ct(m),{key:U(f)(String(H.name))})):Q("",!0)],1032,["max"])),c(H)?Q("",!0):(N(),ve(ct(m),{key:String(H.name)}))]),_:1})]),_:1})]),_:1})]),_:1},8,["has-sider"]),I(d,{show:l.value,"onUpdate:show":x[3]||(x[3]=m=>l.value=m),placement:"left",width:250,"z-index":2e3,"content-style":u,"aria-label":"导航菜单"},{default:j(()=>[C("div",ri,[C("img",{class:"brand-mark",src:U(vt),alt:"系统 Logo"},null,8,ni),x[4]||(x[4]=C("span",null,"HXNI 电气无忧",-1))]),I(S,{class:"drawer-menu","icon-size":16,options:p.value,value:String(U(o).name||""),"expanded-keys":P.value,"onUpdate:expandedKeys":_,"onUpdate:value":a},null,8,["options","value","expanded-keys"]),C("div",ii,[I(yt,{"z-index":2001})])]),_:1},8,["show"])],64)}}}),Ni=Se(li,[["__scopeId","data-v-300e659c"]]);export{Ni as default};
