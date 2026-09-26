import{d as $,n as c,p as v,q as u,s as _,t as f,v as ne,x as J,y as ae,z as ko,A as w,C as se,D as Q,E as re,r as F,F as zo,G as So,H as _o,I as Io,J as Z,K as Me,L as Ro,T as eo,M as oo,S as Pe,N as Ue,O as Mo,P as $e,Q as $o,R as Bo,U as Oo,V as to,W as To,X as Eo,Y as Po,Z as Ao,$ as pe,a0 as No,a1 as Ho,a2 as jo,a3 as Lo,a4 as Fo,a5 as Do,a6 as V,a7 as Ko,a8 as Uo,a9 as Vo,aa as Wo,ab as Ve,ac as ro,ad as no,ae as ce,af as Yo,ag as le,ah as Ae,ai as Be,aj as io,ak as Ie,al as Xo,am as Go,an as qo,ao as Jo,o as H,c as D,ap as ge,b as y,aq as lo,ar as Qo,u as Zo,as as et,a as ot,at as tt,au as rt,g as X,w as q,e as U,av as de,aw as ee,ax as nt,f as We,ay as me,az as it,aA as Ye,aB as lt,i as at,aC as st,h as ct}from"./index-DiWDHsV5.js";import{N as dt,a as Oe}from"./Icon-DiRVuw8a.js";import{L as Xe}from"./branding-DF66JUkZ.js";import{u as he,f as ue}from"./get-Xt2e7D5F.js";import{C as ut,N as ao}from"./Dropdown-DIL3XbPM.js";import{V as ht,c as Re}from"./Popover-CMQDBUcJ.js";import{u as vt}from"./use-compitable-BVu4-tV_.js";import{_ as mt}from"./_plugin-vue_export-helper-DlAUqK2U.js";import"./use-keyboard-CWAOrwvR.js";const ft=$({name:"ChevronDownFilled",render(){return c("svg",{viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg"},c("path",{d:"M3.20041 5.73966C3.48226 5.43613 3.95681 5.41856 4.26034 5.70041L8 9.22652L11.7397 5.70041C12.0432 5.41856 12.5177 5.43613 12.7996 5.73966C13.0815 6.0432 13.0639 6.51775 12.7603 6.7996L8.51034 10.7996C8.22258 11.0668 7.77743 11.0668 7.48967 10.7996L3.23966 6.7996C2.93613 6.51775 2.91856 6.0432 3.20041 5.73966Z",fill:"currentColor"}))}}),pt=v("breadcrumb",`
 white-space: nowrap;
 cursor: default;
 line-height: var(--n-item-line-height);
`,[u("ul",`
 list-style: none;
 padding: 0;
 margin: 0;
 `),u("a",`
 color: inherit;
 text-decoration: inherit;
 `),v("breadcrumb-item",`
 font-size: var(--n-font-size);
 transition: color .3s var(--n-bezier);
 display: inline-flex;
 align-items: center;
 `,[v("icon",`
 font-size: 18px;
 vertical-align: -.2em;
 transition: color .3s var(--n-bezier);
 color: var(--n-item-text-color);
 `),u("&:not(:last-child)",[_("clickable",[f("link",`
 cursor: pointer;
 `,[u("&:hover",`
 background-color: var(--n-item-color-hover);
 `),u("&:active",`
 background-color: var(--n-item-color-pressed); 
 `)])])]),f("link",`
 padding: 4px;
 border-radius: var(--n-item-border-radius);
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 color: var(--n-item-text-color);
 position: relative;
 `,[u("&:hover",`
 color: var(--n-item-text-color-hover);
 `,[v("icon",`
 color: var(--n-item-text-color-hover);
 `)]),u("&:active",`
 color: var(--n-item-text-color-pressed);
 `,[v("icon",`
 color: var(--n-item-text-color-pressed);
 `)])]),f("separator",`
 margin: 0 8px;
 color: var(--n-separator-color);
 transition: color .3s var(--n-bezier);
 user-select: none;
 -webkit-user-select: none;
 `),u("&:last-child",[f("link",`
 font-weight: var(--n-font-weight-active);
 cursor: unset;
 color: var(--n-item-text-color-active);
 `,[v("icon",`
 color: var(--n-item-text-color-active);
 `)]),f("separator",`
 display: none;
 `)])])]),so=se("n-breadcrumb"),gt=Object.assign(Object.assign({},J.props),{separator:{type:String,default:"/"}}),bt=$({name:"Breadcrumb",props:gt,setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:t}=ne(e),n=J("Breadcrumb","-breadcrumb",pt,ko,e,o);Q(so,{separatorRef:re(e,"separator"),mergedClsPrefixRef:o});const i=w(()=>{const{common:{cubicBezierEaseInOut:d},self:{separatorColor:m,itemTextColor:s,itemTextColorHover:p,itemTextColorPressed:P,itemTextColorActive:B,fontSize:b,fontWeightActive:T,itemBorderRadius:E,itemColorHover:I,itemColorPressed:C,itemLineHeight:k}}=n.value;return{"--n-font-size":b,"--n-bezier":d,"--n-item-text-color":s,"--n-item-text-color-hover":p,"--n-item-text-color-pressed":P,"--n-item-text-color-active":B,"--n-separator-color":m,"--n-item-color-hover":I,"--n-item-color-pressed":C,"--n-item-border-radius":E,"--n-font-weight-active":T,"--n-item-line-height":k}}),l=t?ae("breadcrumb",void 0,i,e):void 0;return{mergedClsPrefix:o,cssVars:t?void 0:i,themeClass:l?.themeClass,onRender:l?.onRender}},render(){var e;return(e=this.onRender)===null||e===void 0||e.call(this),c("nav",{class:[`${this.mergedClsPrefix}-breadcrumb`,this.themeClass],style:this.cssVars,"aria-label":"Breadcrumb"},c("ul",null,this.$slots))}});function xt(e=_o?window:null){const o=()=>{const{hash:i,host:l,hostname:d,href:m,origin:s,pathname:p,port:P,protocol:B,search:b}=e?.location||{};return{hash:i,host:l,hostname:d,href:m,origin:s,pathname:p,port:P,protocol:B,search:b}},t=F(o()),n=()=>{t.value=o()};return zo(()=>{e&&(e.addEventListener("popstate",n),e.addEventListener("hashchange",n))}),So(()=>{e&&(e.removeEventListener("popstate",n),e.removeEventListener("hashchange",n))}),t}const wt={separator:String,href:String,clickable:{type:Boolean,default:!0},showSeparator:{type:Boolean,default:!0},onClick:Function},Ct=$({name:"BreadcrumbItem",props:wt,slots:Object,setup(e,{slots:o}){const t=Z(so,null);if(!t)return()=>null;const{separatorRef:n,mergedClsPrefixRef:i}=t,l=xt(),d=w(()=>e.href?"a":"span"),m=w(()=>l.value.href===e.href?"location":null);return()=>{const{value:s}=i;return c("li",{class:[`${s}-breadcrumb-item`,e.clickable&&`${s}-breadcrumb-item--clickable`]},c(d.value,{class:`${s}-breadcrumb-item__link`,"aria-current":m.value,href:e.href,onClick:e.onClick},o),e.showSeparator&&c("span",{class:`${s}-breadcrumb-item__separator`,"aria-hidden":"true"},Io(o.separator,()=>{var p;return[(p=e.separator)!==null&&p!==void 0?p:n.value]})))}}}),yt=$({name:"NDrawerContent",inheritAttrs:!1,props:{blockScroll:Boolean,show:{type:Boolean,default:void 0},displayDirective:{type:String,required:!0},placement:{type:String,required:!0},contentClass:String,contentStyle:[Object,String],nativeScrollbar:{type:Boolean,required:!0},scrollbarProps:Object,trapFocus:{type:Boolean,default:!0},autoFocus:{type:Boolean,default:!0},showMask:{type:[Boolean,String],required:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,onClickoutside:Function,onAfterLeave:Function,onAfterEnter:Function,onEsc:Function},setup(e){const o=F(!!e.show),t=F(null),n=Z(to);let i=0,l="",d=null;const m=F(!1),s=F(!1),p=w(()=>e.placement==="top"||e.placement==="bottom"),{mergedClsPrefixRef:P,mergedRtlRef:B}=ne(e),b=Mo("Drawer",B,P),T=h,E=z=>{s.value=!0,i=p.value?z.clientY:z.clientX,l=document.body.style.cursor,document.body.style.cursor=p.value?"ns-resize":"ew-resize",document.body.addEventListener("mousemove",M),document.body.addEventListener("mouseleave",T),document.body.addEventListener("mouseup",h)},I=()=>{d!==null&&(window.clearTimeout(d),d=null),s.value?m.value=!0:d=window.setTimeout(()=>{m.value=!0},300)},C=()=>{d!==null&&(window.clearTimeout(d),d=null),m.value=!1},{doUpdateHeight:k,doUpdateWidth:G}=n,W=z=>{const{maxWidth:j}=e;if(j&&z>j)return j;const{minWidth:O}=e;return O&&z<O?O:z},K=z=>{const{maxHeight:j}=e;if(j&&z>j)return j;const{minHeight:O}=e;return O&&z<O?O:z};function M(z){var j,O;if(s.value)if(p.value){let L=((j=t.value)===null||j===void 0?void 0:j.offsetHeight)||0;const Y=i-z.clientY;L+=e.placement==="bottom"?Y:-Y,L=K(L),k(L),i=z.clientY}else{let L=((O=t.value)===null||O===void 0?void 0:O.offsetWidth)||0;const Y=i-z.clientX;L+=e.placement==="right"?Y:-Y,L=W(L),G(L),i=z.clientX}}function h(){s.value&&(i=0,s.value=!1,document.body.style.cursor=l,document.body.removeEventListener("mousemove",M),document.body.removeEventListener("mouseup",h),document.body.removeEventListener("mouseleave",T))}$e(()=>{e.show&&(o.value=!0)}),$o(()=>e.show,z=>{z||h()}),Bo(()=>{h()});const g=w(()=>{const{show:z}=e,j=[[Ue,z]];return e.showMask||j.push([To,e.onClickoutside,void 0,{capture:!0}]),j});function A(){var z;o.value=!1,(z=e.onAfterLeave)===null||z===void 0||z.call(e)}return Oo(w(()=>e.blockScroll&&o.value)),Q(Eo,t),Q(Po,null),Q(Ao,null),{bodyRef:t,rtlEnabled:b,mergedClsPrefix:n.mergedClsPrefixRef,isMounted:n.isMountedRef,mergedTheme:n.mergedThemeRef,displayed:o,transitionName:w(()=>({right:"slide-in-from-right-transition",left:"slide-in-from-left-transition",top:"slide-in-from-top-transition",bottom:"slide-in-from-bottom-transition"})[e.placement]),handleAfterLeave:A,bodyDirectives:g,handleMousedownResizeTrigger:E,handleMouseenterResizeTrigger:I,handleMouseleaveResizeTrigger:C,isDragging:s,isHoverOnResizeTrigger:m}},render(){const{$slots:e,mergedClsPrefix:o}=this;return this.displayDirective==="show"||this.displayed||this.show?Me(c("div",{role:"none"},c(Ro,{disabled:!this.showMask||!this.trapFocus,active:this.show,autoFocus:this.autoFocus,onEsc:this.onEsc},{default:()=>c(eo,{name:this.transitionName,appear:this.isMounted,onAfterEnter:this.onAfterEnter,onAfterLeave:this.handleAfterLeave},{default:()=>Me(c("div",oo(this.$attrs,{role:"dialog",ref:"bodyRef","aria-modal":"true",class:[`${o}-drawer`,this.rtlEnabled&&`${o}-drawer--rtl`,`${o}-drawer--${this.placement}-placement`,this.isDragging&&`${o}-drawer--unselectable`,this.nativeScrollbar&&`${o}-drawer--native-scrollbar`]}),[this.resizable?c("div",{class:[`${o}-drawer__resize-trigger`,(this.isDragging||this.isHoverOnResizeTrigger)&&`${o}-drawer__resize-trigger--hover`],onMouseenter:this.handleMouseenterResizeTrigger,onMouseleave:this.handleMouseleaveResizeTrigger,onMousedown:this.handleMousedownResizeTrigger}):null,this.nativeScrollbar?c("div",{class:[`${o}-drawer-content-wrapper`,this.contentClass],style:this.contentStyle,role:"none"},e):c(Pe,Object.assign({},this.scrollbarProps,{contentStyle:this.contentStyle,contentClass:[`${o}-drawer-content-wrapper`,this.contentClass],theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar}),e)]),this.bodyDirectives)})})),[[Ue,this.displayDirective==="if"||this.displayed||this.show]]):null}}),{cubicBezierEaseIn:kt,cubicBezierEaseOut:zt}=pe;function St({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-bottom"}={}){return[u(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${kt}`}),u(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${zt}`}),u(`&.${t}-transition-enter-to`,{transform:"translateY(0)"}),u(`&.${t}-transition-enter-from`,{transform:"translateY(100%)"}),u(`&.${t}-transition-leave-from`,{transform:"translateY(0)"}),u(`&.${t}-transition-leave-to`,{transform:"translateY(100%)"})]}const{cubicBezierEaseIn:_t,cubicBezierEaseOut:It}=pe;function Rt({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-left"}={}){return[u(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${_t}`}),u(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${It}`}),u(`&.${t}-transition-enter-to`,{transform:"translateX(0)"}),u(`&.${t}-transition-enter-from`,{transform:"translateX(-100%)"}),u(`&.${t}-transition-leave-from`,{transform:"translateX(0)"}),u(`&.${t}-transition-leave-to`,{transform:"translateX(-100%)"})]}const{cubicBezierEaseIn:Mt,cubicBezierEaseOut:$t}=pe;function Bt({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-right"}={}){return[u(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${Mt}`}),u(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${$t}`}),u(`&.${t}-transition-enter-to`,{transform:"translateX(0)"}),u(`&.${t}-transition-enter-from`,{transform:"translateX(100%)"}),u(`&.${t}-transition-leave-from`,{transform:"translateX(0)"}),u(`&.${t}-transition-leave-to`,{transform:"translateX(100%)"})]}const{cubicBezierEaseIn:Ot,cubicBezierEaseOut:Tt}=pe;function Et({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-top"}={}){return[u(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${Ot}`}),u(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${Tt}`}),u(`&.${t}-transition-enter-to`,{transform:"translateY(0)"}),u(`&.${t}-transition-enter-from`,{transform:"translateY(-100%)"}),u(`&.${t}-transition-leave-from`,{transform:"translateY(0)"}),u(`&.${t}-transition-leave-to`,{transform:"translateY(-100%)"})]}const Pt=u([v("drawer",`
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
 `,[Bt(),Rt(),Et(),St(),_("unselectable",`
 user-select: none; 
 -webkit-user-select: none;
 `),_("native-scrollbar",[v("drawer-content-wrapper",`
 overflow: auto;
 height: 100%;
 `)]),f("resize-trigger",`
 position: absolute;
 background-color: #0000;
 transition: background-color .3s var(--n-bezier);
 `,[_("hover",`
 background-color: var(--n-resize-trigger-color-hover);
 `)]),v("drawer-content-wrapper",`
 box-sizing: border-box;
 `),v("drawer-content",`
 height: 100%;
 display: flex;
 flex-direction: column;
 `,[_("native-scrollbar",[v("drawer-body-content-wrapper",`
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
 `,[f("main",`
 flex: 1;
 `),f("close",`
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
 `)]),_("right-placement",`
 top: 0;
 bottom: 0;
 right: 0;
 border-top-left-radius: var(--n-border-radius);
 border-bottom-left-radius: var(--n-border-radius);
 `,[f("resize-trigger",`
 width: 3px;
 height: 100%;
 top: 0;
 left: 0;
 transform: translateX(-1.5px);
 cursor: ew-resize;
 `)]),_("left-placement",`
 top: 0;
 bottom: 0;
 left: 0;
 border-top-right-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `,[f("resize-trigger",`
 width: 3px;
 height: 100%;
 top: 0;
 right: 0;
 transform: translateX(1.5px);
 cursor: ew-resize;
 `)]),_("top-placement",`
 top: 0;
 left: 0;
 right: 0;
 border-bottom-left-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `,[f("resize-trigger",`
 width: 100%;
 height: 3px;
 bottom: 0;
 left: 0;
 transform: translateY(1.5px);
 cursor: ns-resize;
 `)]),_("bottom-placement",`
 left: 0;
 bottom: 0;
 right: 0;
 border-top-left-radius: var(--n-border-radius);
 border-top-right-radius: var(--n-border-radius);
 `,[f("resize-trigger",`
 width: 100%;
 height: 3px;
 top: 0;
 left: 0;
 transform: translateY(-1.5px);
 cursor: ns-resize;
 `)])]),u("body",[u(">",[v("drawer-container",`
 position: fixed;
 `)])]),v("drawer-container",`
 position: relative;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 pointer-events: none;
 `,[u("> *",`
 pointer-events: all;
 `)]),v("drawer-mask",`
 background-color: rgba(0, 0, 0, .3);
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `,[_("invisible",`
 background-color: rgba(0, 0, 0, 0)
 `),No({enterDuration:"0.2s",leaveDuration:"0.2s",enterCubicBezier:"var(--n-bezier-in)",leaveCubicBezier:"var(--n-bezier-out)"})])]),At=Object.assign(Object.assign({},J.props),{show:Boolean,width:[Number,String],height:[Number,String],placement:{type:String,default:"right"},maskClosable:{type:Boolean,default:!0},showMask:{type:[Boolean,String],default:!0},to:[String,Object],displayDirective:{type:String,default:"if"},nativeScrollbar:{type:Boolean,default:!0},zIndex:Number,onMaskClick:Function,scrollbarProps:Object,contentClass:String,contentStyle:[Object,String],trapFocus:{type:Boolean,default:!0},onEsc:Function,autoFocus:{type:Boolean,default:!0},closeOnEsc:{type:Boolean,default:!0},blockScroll:{type:Boolean,default:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,defaultWidth:{type:[Number,String],default:251},defaultHeight:{type:[Number,String],default:251},onUpdateWidth:[Function,Array],onUpdateHeight:[Function,Array],"onUpdate:width":[Function,Array],"onUpdate:height":[Function,Array],"onUpdate:show":[Function,Array],onUpdateShow:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,drawerStyle:[String,Object],drawerClass:String,target:null,onShow:Function,onHide:Function}),Nt=$({name:"Drawer",inheritAttrs:!1,props:At,setup(e){const{mergedClsPrefixRef:o,namespaceRef:t,inlineThemeDisabled:n}=ne(e),i=jo(),l=J("Drawer","-drawer",Pt,Ko,e,o),d=F(e.defaultWidth),m=F(e.defaultHeight),s=he(re(e,"width"),d),p=he(re(e,"height"),m),P=w(()=>{const{placement:h}=e;return h==="top"||h==="bottom"?"":ue(s.value)}),B=w(()=>{const{placement:h}=e;return h==="left"||h==="right"?"":ue(p.value)}),b=h=>{const{onUpdateWidth:g,"onUpdate:width":A}=e;g&&V(g,h),A&&V(A,h),d.value=h},T=h=>{const{onUpdateHeight:g,"onUpdate:width":A}=e;g&&V(g,h),A&&V(A,h),m.value=h},E=w(()=>[{width:P.value,height:B.value},e.drawerStyle||""]);function I(h){const{onMaskClick:g,maskClosable:A}=e;A&&W(!1),g&&g(h)}function C(h){I(h)}const k=Lo();function G(h){var g;(g=e.onEsc)===null||g===void 0||g.call(e),e.show&&e.closeOnEsc&&Do(h)&&(k.value||W(!1))}function W(h){const{onHide:g,onUpdateShow:A,"onUpdate:show":z}=e;A&&V(A,h),z&&V(z,h),g&&!h&&V(g,h)}Q(to,{isMountedRef:i,mergedThemeRef:l,mergedClsPrefixRef:o,doUpdateShow:W,doUpdateHeight:T,doUpdateWidth:b});const K=w(()=>{const{common:{cubicBezierEaseInOut:h,cubicBezierEaseIn:g,cubicBezierEaseOut:A},self:{color:z,textColor:j,boxShadow:O,lineHeight:L,headerPadding:Y,footerPadding:ie,borderRadius:be,bodyPadding:xe,titleFontSize:we,titleTextColor:Ce,titleFontWeight:ye,headerBorderBottom:ke,footerBorderTop:x,closeIconColor:R,closeIconColorHover:r,closeIconColorPressed:S,closeColorHover:N,closeColorPressed:ze,closeIconSize:Se,closeSize:_e,closeBorderRadius:a,resizableTriggerColorHover:yo}}=l.value;return{"--n-line-height":L,"--n-color":z,"--n-border-radius":be,"--n-text-color":j,"--n-box-shadow":O,"--n-bezier":h,"--n-bezier-out":A,"--n-bezier-in":g,"--n-header-padding":Y,"--n-body-padding":xe,"--n-footer-padding":ie,"--n-title-text-color":Ce,"--n-title-font-size":we,"--n-title-font-weight":ye,"--n-header-border-bottom":ke,"--n-footer-border-top":x,"--n-close-icon-color":R,"--n-close-icon-color-hover":r,"--n-close-icon-color-pressed":S,"--n-close-size":_e,"--n-close-color-hover":N,"--n-close-color-pressed":ze,"--n-close-icon-size":Se,"--n-close-border-radius":a,"--n-resize-trigger-color-hover":yo}}),M=n?ae("drawer",void 0,K,e):void 0;return{mergedClsPrefix:o,namespace:t,mergedBodyStyle:E,handleOutsideClick:C,handleMaskClick:I,handleEsc:G,mergedTheme:l,cssVars:n?void 0:K,themeClass:M?.themeClass,onRender:M?.onRender,isMounted:i}},render(){const{mergedClsPrefix:e}=this;return c(Ho,{to:this.to,show:this.show},{default:()=>{var o;return(o=this.onRender)===null||o===void 0||o.call(this),Me(c("div",{class:[`${e}-drawer-container`,this.namespace,this.themeClass],style:this.cssVars,role:"none"},this.showMask?c(eo,{name:"fade-in-transition",appear:this.isMounted},{default:()=>this.show?c("div",{"aria-hidden":!0,class:[`${e}-drawer-mask`,this.showMask==="transparent"&&`${e}-drawer-mask--invisible`],onClick:this.handleMaskClick}):null}):null,c(yt,Object.assign({},this.$attrs,{class:[this.drawerClass,this.$attrs.class],style:[this.mergedBodyStyle,this.$attrs.style],blockScroll:this.blockScroll,contentStyle:this.contentStyle,contentClass:this.contentClass,placement:this.placement,scrollbarProps:this.scrollbarProps,show:this.show,displayDirective:this.displayDirective,nativeScrollbar:this.nativeScrollbar,onAfterEnter:this.onAfterEnter,onAfterLeave:this.onAfterLeave,trapFocus:this.trapFocus,autoFocus:this.autoFocus,resizable:this.resizable,maxHeight:this.maxHeight,minHeight:this.minHeight,maxWidth:this.maxWidth,minWidth:this.minWidth,showMask:this.showMask,onEsc:this.handleEsc,onClickoutside:this.handleOutsideClick}),this.$slots)),[[Fo,{zIndex:this.zIndex,enabled:this.show}]])}})}});function Ht(e){const{baseColor:o,textColor2:t,bodyColor:n,cardColor:i,dividerColor:l,actionColor:d,scrollbarColor:m,scrollbarColorHover:s,invertedColor:p}=e;return{textColor:t,textColorInverted:"#FFF",color:n,colorEmbedded:d,headerColor:i,headerColorInverted:p,footerColor:d,footerColorInverted:p,headerBorderColor:l,headerBorderColorInverted:p,footerBorderColor:l,footerBorderColorInverted:p,siderBorderColor:l,siderBorderColorInverted:p,siderColor:i,siderColorInverted:p,siderToggleButtonBorder:`1px solid ${l}`,siderToggleButtonColor:o,siderToggleButtonIconColor:t,siderToggleButtonIconColorInverted:t,siderToggleBarColor:Ve(n,m),siderToggleBarColorHover:Ve(n,s),__invertScrollbar:"true"}}const Ne=Uo({name:"Layout",common:Wo,peers:{Scrollbar:Vo},self:Ht}),co=se("n-layout-sider"),He={type:String,default:"static"},jt=v("layout",`
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
 `),_("absolute-positioned",`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),Lt={embedded:Boolean,position:He,nativeScrollbar:{type:Boolean,default:!0},scrollbarProps:Object,onScroll:Function,contentClass:String,contentStyle:{type:[String,Object],default:""},hasSider:Boolean,siderPlacement:{type:String,default:"left"}},uo=se("n-layout");function ho(e){return $({name:e?"LayoutContent":"Layout",props:Object.assign(Object.assign({},J.props),Lt),setup(o){const t=F(null),n=F(null),{mergedClsPrefixRef:i,inlineThemeDisabled:l}=ne(o),d=J("Layout","-layout",jt,Ne,o,i);function m(I,C){if(o.nativeScrollbar){const{value:k}=t;k&&(C===void 0?k.scrollTo(I):k.scrollTo(I,C))}else{const{value:k}=n;k&&k.scrollTo(I,C)}}Q(uo,o);let s=0,p=0;const P=I=>{var C;const k=I.target;s=k.scrollLeft,p=k.scrollTop,(C=o.onScroll)===null||C===void 0||C.call(o,I)};ro(()=>{if(o.nativeScrollbar){const I=t.value;I&&(I.scrollTop=p,I.scrollLeft=s)}});const B={display:"flex",flexWrap:"nowrap",width:"100%",flexDirection:"row"},b={scrollTo:m},T=w(()=>{const{common:{cubicBezierEaseInOut:I},self:C}=d.value;return{"--n-bezier":I,"--n-color":o.embedded?C.colorEmbedded:C.color,"--n-text-color":C.textColor}}),E=l?ae("layout",w(()=>o.embedded?"e":""),T,o):void 0;return Object.assign({mergedClsPrefix:i,scrollableElRef:t,scrollbarInstRef:n,hasSiderStyle:B,mergedTheme:d,handleNativeElScroll:P,cssVars:l?void 0:T,themeClass:E?.themeClass,onRender:E?.onRender},b)},render(){var o;const{mergedClsPrefix:t,hasSider:n}=this;(o=this.onRender)===null||o===void 0||o.call(this);const i=n?this.hasSiderStyle:void 0,l=[this.themeClass,e&&`${t}-layout-content`,`${t}-layout`,`${t}-layout--${this.position}-positioned`];return c("div",{class:l,style:this.cssVars},this.nativeScrollbar?c("div",{ref:"scrollableElRef",class:[`${t}-layout-scroll-container`,this.contentClass],style:[this.contentStyle,i],onScroll:this.handleNativeElScroll},this.$slots):c(Pe,Object.assign({},this.scrollbarProps,{onScroll:this.onScroll,ref:"scrollbarInstRef",theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,contentClass:this.contentClass,contentStyle:[this.contentStyle,i]}),this.$slots))}})}const Ft=ho(!1),Dt=ho(!0),Kt=v("layout-header",`
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 box-sizing: border-box;
 width: 100%;
 background-color: var(--n-color);
 color: var(--n-text-color);
`,[_("absolute-positioned",`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 `),_("bordered",`
 border-bottom: solid 1px var(--n-border-color);
 `)]),Ut={position:He,inverted:Boolean,bordered:{type:Boolean,default:!1}},Vt=$({name:"LayoutHeader",props:Object.assign(Object.assign({},J.props),Ut),setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:t}=ne(e),n=J("Layout","-layout-header",Kt,Ne,e,o),i=w(()=>{const{common:{cubicBezierEaseInOut:d},self:m}=n.value,s={"--n-bezier":d};return e.inverted?(s["--n-color"]=m.headerColorInverted,s["--n-text-color"]=m.textColorInverted,s["--n-border-color"]=m.headerBorderColorInverted):(s["--n-color"]=m.headerColor,s["--n-text-color"]=m.textColor,s["--n-border-color"]=m.headerBorderColor),s}),l=t?ae("layout-header",w(()=>e.inverted?"a":"b"),i,e):void 0;return{mergedClsPrefix:o,cssVars:t?void 0:i,themeClass:l?.themeClass,onRender:l?.onRender}},render(){var e;const{mergedClsPrefix:o}=this;return(e=this.onRender)===null||e===void 0||e.call(this),c("div",{class:[`${o}-layout-header`,this.themeClass,this.position&&`${o}-layout-header--${this.position}-positioned`,this.bordered&&`${o}-layout-header--bordered`],style:this.cssVars},this.$slots)}}),Wt=v("layout-sider",`
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
`,[_("bordered",[f("border",`
 content: "";
 position: absolute;
 top: 0;
 bottom: 0;
 width: 1px;
 background-color: var(--n-border-color);
 transition: background-color .3s var(--n-bezier);
 `)]),f("left-placement",[_("bordered",[f("border",`
 right: 0;
 `)])]),_("right-placement",`
 justify-content: flex-start;
 `,[_("bordered",[f("border",`
 left: 0;
 `)]),_("collapsed",[v("layout-toggle-button",[v("base-icon",`
 transform: rotate(180deg);
 `)]),v("layout-toggle-bar",[u("&:hover",[f("top",{transform:"rotate(-12deg) scale(1.15) translateY(-2px)"}),f("bottom",{transform:"rotate(12deg) scale(1.15) translateY(2px)"})])])]),v("layout-toggle-button",`
 left: 0;
 transform: translateX(-50%) translateY(-50%);
 `,[v("base-icon",`
 transform: rotate(0);
 `)]),v("layout-toggle-bar",`
 left: -28px;
 transform: rotate(180deg);
 `,[u("&:hover",[f("top",{transform:"rotate(12deg) scale(1.15) translateY(-2px)"}),f("bottom",{transform:"rotate(-12deg) scale(1.15) translateY(2px)"})])])]),_("collapsed",[v("layout-toggle-bar",[u("&:hover",[f("top",{transform:"rotate(-12deg) scale(1.15) translateY(-2px)"}),f("bottom",{transform:"rotate(12deg) scale(1.15) translateY(2px)"})])]),v("layout-toggle-button",[v("base-icon",`
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
 `,[f("top, bottom",`
 position: absolute;
 width: 4px;
 border-radius: 2px;
 height: 38px;
 left: 14px;
 transition: 
 background-color .3s var(--n-bezier),
 transform .3s var(--n-bezier);
 `),f("bottom",`
 position: absolute;
 top: 34px;
 `),u("&:hover",[f("top",{transform:"rotate(12deg) scale(1.15) translateY(-2px)"}),f("bottom",{transform:"rotate(-12deg) scale(1.15) translateY(2px)"})]),f("top, bottom",{backgroundColor:"var(--n-toggle-bar-color)"}),u("&:hover",[f("top, bottom",{backgroundColor:"var(--n-toggle-bar-color-hover)"})])]),f("border",`
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
 `),_("show-content",[v("layout-sider-scroll-container",{opacity:1})]),_("absolute-positioned",`
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 `)]),Yt=$({props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){const{clsPrefix:e}=this;return c("div",{onClick:this.onClick,class:`${e}-layout-toggle-bar`},c("div",{class:`${e}-layout-toggle-bar__top`}),c("div",{class:`${e}-layout-toggle-bar__bottom`}))}}),Xt=$({name:"LayoutToggleButton",props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){const{clsPrefix:e}=this;return c("div",{class:`${e}-layout-toggle-button`,onClick:this.onClick},c(no,{clsPrefix:e},{default:()=>c(ut,null)}))}}),Gt={position:He,bordered:Boolean,collapsedWidth:{type:Number,default:48},width:{type:[Number,String],default:272},contentClass:String,contentStyle:{type:[String,Object],default:""},collapseMode:{type:String,default:"transform"},collapsed:{type:Boolean,default:void 0},defaultCollapsed:Boolean,showCollapsedContent:{type:Boolean,default:!0},showTrigger:{type:[Boolean,String],default:!1},nativeScrollbar:{type:Boolean,default:!0},inverted:Boolean,scrollbarProps:Object,triggerClass:String,triggerStyle:[String,Object],collapsedTriggerClass:String,collapsedTriggerStyle:[String,Object],"onUpdate:collapsed":[Function,Array],onUpdateCollapsed:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,onExpand:[Function,Array],onCollapse:[Function,Array],onScroll:Function},qt=$({name:"LayoutSider",props:Object.assign(Object.assign({},J.props),Gt),setup(e){const o=Z(uo),t=F(null),n=F(null),i=F(e.defaultCollapsed),l=he(re(e,"collapsed"),i),d=w(()=>ue(l.value?e.collapsedWidth:e.width)),m=w(()=>e.collapseMode!=="transform"?{}:{minWidth:ue(e.width)}),s=w(()=>o?o.siderPlacement:"left");function p(M,h){if(e.nativeScrollbar){const{value:g}=t;g&&(h===void 0?g.scrollTo(M):g.scrollTo(M,h))}else{const{value:g}=n;g&&g.scrollTo(M,h)}}function P(){const{"onUpdate:collapsed":M,onUpdateCollapsed:h,onExpand:g,onCollapse:A}=e,{value:z}=l;h&&V(h,!z),M&&V(M,!z),i.value=!z,z?g&&V(g):A&&V(A)}let B=0,b=0;const T=M=>{var h;const g=M.target;B=g.scrollLeft,b=g.scrollTop,(h=e.onScroll)===null||h===void 0||h.call(e,M)};ro(()=>{if(e.nativeScrollbar){const M=t.value;M&&(M.scrollTop=b,M.scrollLeft=B)}}),Q(co,{collapsedRef:l,collapseModeRef:re(e,"collapseMode")});const{mergedClsPrefixRef:E,inlineThemeDisabled:I}=ne(e),C=J("Layout","-layout-sider",Wt,Ne,e,E);function k(M){var h,g;M.propertyName==="max-width"&&(l.value?(h=e.onAfterLeave)===null||h===void 0||h.call(e):(g=e.onAfterEnter)===null||g===void 0||g.call(e))}const G={scrollTo:p},W=w(()=>{const{common:{cubicBezierEaseInOut:M},self:h}=C.value,{siderToggleButtonColor:g,siderToggleButtonBorder:A,siderToggleBarColor:z,siderToggleBarColorHover:j}=h,O={"--n-bezier":M,"--n-toggle-button-color":g,"--n-toggle-button-border":A,"--n-toggle-bar-color":z,"--n-toggle-bar-color-hover":j};return e.inverted?(O["--n-color"]=h.siderColorInverted,O["--n-text-color"]=h.textColorInverted,O["--n-border-color"]=h.siderBorderColorInverted,O["--n-toggle-button-icon-color"]=h.siderToggleButtonIconColorInverted,O.__invertScrollbar=h.__invertScrollbar):(O["--n-color"]=h.siderColor,O["--n-text-color"]=h.textColor,O["--n-border-color"]=h.siderBorderColor,O["--n-toggle-button-icon-color"]=h.siderToggleButtonIconColor),O}),K=I?ae("layout-sider",w(()=>e.inverted?"a":"b"),W,e):void 0;return Object.assign({scrollableElRef:t,scrollbarInstRef:n,mergedClsPrefix:E,mergedTheme:C,styleMaxWidth:d,mergedCollapsed:l,scrollContainerStyle:m,siderPlacement:s,handleNativeElScroll:T,handleTransitionend:k,handleTriggerClick:P,inlineThemeDisabled:I,cssVars:W,themeClass:K?.themeClass,onRender:K?.onRender},G)},render(){var e;const{mergedClsPrefix:o,mergedCollapsed:t,showTrigger:n}=this;return(e=this.onRender)===null||e===void 0||e.call(this),c("aside",{class:[`${o}-layout-sider`,this.themeClass,`${o}-layout-sider--${this.position}-positioned`,`${o}-layout-sider--${this.siderPlacement}-placement`,this.bordered&&`${o}-layout-sider--bordered`,t&&`${o}-layout-sider--collapsed`,(!t||this.showCollapsedContent)&&`${o}-layout-sider--show-content`],onTransitionend:this.handleTransitionend,style:[this.inlineThemeDisabled?void 0:this.cssVars,{maxWidth:this.styleMaxWidth,width:ue(this.width)}]},this.nativeScrollbar?c("div",{class:[`${o}-layout-sider-scroll-container`,this.contentClass],onScroll:this.handleNativeElScroll,style:[this.scrollContainerStyle,{overflow:"auto"},this.contentStyle],ref:"scrollableElRef"},this.$slots):c(Pe,Object.assign({},this.scrollbarProps,{onScroll:this.onScroll,ref:"scrollbarInstRef",style:this.scrollContainerStyle,contentStyle:this.contentStyle,contentClass:this.contentClass,theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,builtinThemeOverrides:this.inverted&&this.cssVars.__invertScrollbar==="true"?{colorHover:"rgba(255, 255, 255, .4)",color:"rgba(255, 255, 255, .3)"}:void 0}),this.$slots),n?n==="bar"?c(Yt,{clsPrefix:o,class:t?this.collapsedTriggerClass:this.triggerClass,style:t?this.collapsedTriggerStyle:this.triggerStyle,onClick:this.handleTriggerClick}):c(Xt,{clsPrefix:o,class:t?this.collapsedTriggerClass:this.triggerClass,style:t?this.collapsedTriggerStyle:this.triggerStyle,onClick:this.handleTriggerClick}):null,this.bordered?c("div",{class:`${o}-layout-sider__border`}):null)}}),ve=se("n-menu"),vo=se("n-submenu"),je=se("n-menu-item-group"),Ge=[u("&::before","background-color: var(--n-item-color-hover);"),f("arrow",`
 color: var(--n-arrow-color-hover);
 `),f("icon",`
 color: var(--n-item-icon-color-hover);
 `),v("menu-item-content-header",`
 color: var(--n-item-text-color-hover);
 `,[u("a",`
 color: var(--n-item-text-color-hover);
 `),f("extra",`
 color: var(--n-item-text-color-hover);
 `)])],qe=[f("icon",`
 color: var(--n-item-icon-color-hover-horizontal);
 `),v("menu-item-content-header",`
 color: var(--n-item-text-color-hover-horizontal);
 `,[u("a",`
 color: var(--n-item-text-color-hover-horizontal);
 `),f("extra",`
 color: var(--n-item-text-color-hover-horizontal);
 `)])],Jt=u([v("menu",`
 background-color: var(--n-color);
 color: var(--n-item-text-color);
 overflow: hidden;
 transition: background-color .3s var(--n-bezier);
 box-sizing: border-box;
 font-size: var(--n-font-size);
 padding-bottom: 6px;
 `,[_("horizontal",`
 max-width: 100%;
 width: 100%;
 display: flex;
 overflow: hidden;
 padding-bottom: 0;
 `,[v("submenu","margin: 0;"),v("menu-item","margin: 0;"),v("menu-item-content",`
 padding: 0 20px;
 border-bottom: 2px solid #0000;
 `,[u("&::before","display: none;"),_("selected","border-bottom: 2px solid var(--n-border-color-horizontal)")]),v("menu-item-content",[_("selected",[f("icon","color: var(--n-item-icon-color-active-horizontal);"),v("menu-item-content-header",`
 color: var(--n-item-text-color-active-horizontal);
 `,[u("a","color: var(--n-item-text-color-active-horizontal);"),f("extra","color: var(--n-item-text-color-active-horizontal);")])]),_("child-active",`
 border-bottom: 2px solid var(--n-border-color-horizontal);
 `,[v("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-horizontal);
 `,[u("a",`
 color: var(--n-item-text-color-child-active-horizontal);
 `),f("extra",`
 color: var(--n-item-text-color-child-active-horizontal);
 `)]),f("icon",`
 color: var(--n-item-icon-color-child-active-horizontal);
 `)]),ce("disabled",[ce("selected, child-active",[u("&:focus-within",qe)]),_("selected",[oe(null,[f("icon","color: var(--n-item-icon-color-active-hover-horizontal);"),v("menu-item-content-header",`
 color: var(--n-item-text-color-active-hover-horizontal);
 `,[u("a","color: var(--n-item-text-color-active-hover-horizontal);"),f("extra","color: var(--n-item-text-color-active-hover-horizontal);")])])]),_("child-active",[oe(null,[f("icon","color: var(--n-item-icon-color-child-active-hover-horizontal);"),v("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-hover-horizontal);
 `,[u("a","color: var(--n-item-text-color-child-active-hover-horizontal);"),f("extra","color: var(--n-item-text-color-child-active-hover-horizontal);")])])]),oe("border-bottom: 2px solid var(--n-border-color-horizontal);",qe)]),v("menu-item-content-header",[u("a","color: var(--n-item-text-color-horizontal);")])])]),ce("responsive",[v("menu-item-content-header",`
 overflow: hidden;
 text-overflow: ellipsis;
 `)]),_("collapsed",[v("menu-item-content",[_("selected",[u("&::before",`
 background-color: var(--n-item-color-active-collapsed) !important;
 `)]),v("menu-item-content-header","opacity: 0;"),f("arrow","opacity: 0;"),f("icon","color: var(--n-item-icon-color-collapsed);")])]),v("menu-item",`
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
 `,[u("> *","z-index: 1;"),u("&::before",`
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
 `),_("disabled",`
 opacity: .45;
 cursor: not-allowed;
 `),_("collapsed",[f("arrow","transform: rotate(0);")]),_("selected",[u("&::before","background-color: var(--n-item-color-active);"),f("arrow","color: var(--n-arrow-color-active);"),f("icon","color: var(--n-item-icon-color-active);"),v("menu-item-content-header",`
 color: var(--n-item-text-color-active);
 `,[u("a","color: var(--n-item-text-color-active);"),f("extra","color: var(--n-item-text-color-active);")])]),_("child-active",[v("menu-item-content-header",`
 color: var(--n-item-text-color-child-active);
 `,[u("a",`
 color: var(--n-item-text-color-child-active);
 `),f("extra",`
 color: var(--n-item-text-color-child-active);
 `)]),f("arrow",`
 color: var(--n-arrow-color-child-active);
 `),f("icon",`
 color: var(--n-item-icon-color-child-active);
 `)]),ce("disabled",[ce("selected, child-active",[u("&:focus-within",Ge)]),_("selected",[oe(null,[f("arrow","color: var(--n-arrow-color-active-hover);"),f("icon","color: var(--n-item-icon-color-active-hover);"),v("menu-item-content-header",`
 color: var(--n-item-text-color-active-hover);
 `,[u("a","color: var(--n-item-text-color-active-hover);"),f("extra","color: var(--n-item-text-color-active-hover);")])])]),_("child-active",[oe(null,[f("arrow","color: var(--n-arrow-color-child-active-hover);"),f("icon","color: var(--n-item-icon-color-child-active-hover);"),v("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-hover);
 `,[u("a","color: var(--n-item-text-color-child-active-hover);"),f("extra","color: var(--n-item-text-color-child-active-hover);")])])]),_("selected",[oe(null,[u("&::before","background-color: var(--n-item-color-active-hover);")])]),oe(null,Ge)]),f("icon",`
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
 `),f("arrow",`
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
 `,[u("a",`
 outline: none;
 text-decoration: none;
 transition: color .3s var(--n-bezier);
 color: var(--n-item-text-color);
 `,[u("&::before",`
 content: "";
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),f("extra",`
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
 `,[Yo({duration:".2s"})])]),v("menu-item-group",[v("menu-item-group-title",`
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
 `)])]),v("menu-tooltip",[u("a",`
 color: inherit;
 text-decoration: none;
 `)]),v("menu-divider",`
 transition: background-color .3s var(--n-bezier);
 background-color: var(--n-divider-color);
 height: 1px;
 margin: 6px 18px;
 `)]);function oe(e,o){return[_("hover",e,o),u("&:hover",e,o)]}const mo=$({name:"MenuOptionContent",props:{collapsed:Boolean,disabled:Boolean,title:[String,Function],icon:Function,extra:[String,Function],showArrow:Boolean,childActive:Boolean,hover:Boolean,paddingLeft:Number,selected:Boolean,maxIconSize:{type:Number,required:!0},activeIconSize:{type:Number,required:!0},iconMarginRight:{type:Number,required:!0},clsPrefix:{type:String,required:!0},onClick:Function,tmNode:{type:Object,required:!0},isEllipsisPlaceholder:Boolean},setup(e){const{props:o}=Z(ve);return{menuProps:o,style:w(()=>{const{paddingLeft:t}=e;return{paddingLeft:t&&`${t}px`}}),iconStyle:w(()=>{const{maxIconSize:t,activeIconSize:n,iconMarginRight:i}=e;return{width:`${t}px`,height:`${t}px`,fontSize:`${n}px`,marginRight:`${i}px`}})}},render(){const{clsPrefix:e,tmNode:o,menuProps:{renderIcon:t,renderLabel:n,renderExtra:i,expandIcon:l}}=this,d=t?t(o.rawNode):le(this.icon);return c("div",{onClick:m=>{var s;(s=this.onClick)===null||s===void 0||s.call(this,m)},role:"none",class:[`${e}-menu-item-content`,{[`${e}-menu-item-content--selected`]:this.selected,[`${e}-menu-item-content--collapsed`]:this.collapsed,[`${e}-menu-item-content--child-active`]:this.childActive,[`${e}-menu-item-content--disabled`]:this.disabled,[`${e}-menu-item-content--hover`]:this.hover}],style:this.style},d&&c("div",{class:`${e}-menu-item-content__icon`,style:this.iconStyle,role:"none"},[d]),c("div",{class:`${e}-menu-item-content-header`,role:"none"},this.isEllipsisPlaceholder?this.title:n?n(o.rawNode):le(this.title),this.extra||i?c("span",{class:`${e}-menu-item-content-header__extra`}," ",i?i(o.rawNode):le(this.extra)):null),this.showArrow?c(no,{ariaHidden:!0,class:`${e}-menu-item-content__arrow`,clsPrefix:e},{default:()=>l?l(o.rawNode):c(ft,null)}):null)}}),fe=8;function Le(e){const o=Z(ve),{props:t,mergedCollapsedRef:n}=o,i=Z(vo,null),l=Z(je,null),d=w(()=>t.mode==="horizontal"),m=w(()=>d.value?t.dropdownPlacement:"tmNodes"in e?"right-start":"right"),s=w(()=>{var b;return Math.max((b=t.collapsedIconSize)!==null&&b!==void 0?b:t.iconSize,t.iconSize)}),p=w(()=>{var b;return!d.value&&e.root&&n.value&&(b=t.collapsedIconSize)!==null&&b!==void 0?b:t.iconSize}),P=w(()=>{if(d.value)return;const{collapsedWidth:b,indent:T,rootIndent:E}=t,{root:I,isGroup:C}=e,k=E===void 0?T:E;return I?n.value?b/2-s.value/2:k:l&&typeof l.paddingLeftRef.value=="number"?T/2+l.paddingLeftRef.value:i&&typeof i.paddingLeftRef.value=="number"?(C?T/2:T)+i.paddingLeftRef.value:0}),B=w(()=>{const{collapsedWidth:b,indent:T,rootIndent:E}=t,{value:I}=s,{root:C}=e;return d.value||!C||!n.value?fe:(E===void 0?T:E)+I+fe-(b+I)/2});return{dropdownPlacement:m,activeIconSize:p,maxIconSize:s,paddingLeft:P,iconMarginRight:B,NMenu:o,NSubmenu:i,NMenuOptionGroup:l}}const Fe={internalKey:{type:[String,Number],required:!0},root:Boolean,isGroup:Boolean,level:{type:Number,required:!0},title:[String,Function],extra:[String,Function]},Qt=$({name:"MenuDivider",setup(){const e=Z(ve),{mergedClsPrefixRef:o,isHorizontalRef:t}=e;return()=>t.value?null:c("div",{class:`${o.value}-menu-divider`})}}),fo=Object.assign(Object.assign({},Fe),{tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function}),Zt=Ae(fo),er=$({name:"MenuOption",props:fo,setup(e){const o=Le(e),{NSubmenu:t,NMenu:n,NMenuOptionGroup:i}=o,{props:l,mergedClsPrefixRef:d,mergedCollapsedRef:m}=n,s=t?t.mergedDisabledRef:i?i.mergedDisabledRef:{value:!1},p=w(()=>s.value||e.disabled);function P(b){const{onClick:T}=e;T&&T(b)}function B(b){p.value||(n.doSelect(e.internalKey,e.tmNode.rawNode),P(b))}return{mergedClsPrefix:d,dropdownPlacement:o.dropdownPlacement,paddingLeft:o.paddingLeft,iconMarginRight:o.iconMarginRight,maxIconSize:o.maxIconSize,activeIconSize:o.activeIconSize,mergedTheme:n.mergedThemeRef,menuProps:l,dropdownEnabled:Be(()=>e.root&&m.value&&l.mode!=="horizontal"&&!p.value),selected:Be(()=>n.mergedValueRef.value===e.internalKey),mergedDisabled:p,handleClick:B}},render(){const{mergedClsPrefix:e,mergedTheme:o,tmNode:t,menuProps:{renderLabel:n,nodeProps:i}}=this,l=i?.(t.rawNode);return c("div",Object.assign({},l,{role:"menuitem",class:[`${e}-menu-item`,l?.class]}),c(dt,{theme:o.peers.Tooltip,themeOverrides:o.peerOverrides.Tooltip,trigger:"hover",placement:this.dropdownPlacement,disabled:!this.dropdownEnabled||this.title===void 0,internalExtraClass:["menu-tooltip"]},{default:()=>n?n(t.rawNode):le(this.title),trigger:()=>c(mo,{tmNode:t,clsPrefix:e,paddingLeft:this.paddingLeft,iconMarginRight:this.iconMarginRight,maxIconSize:this.maxIconSize,activeIconSize:this.activeIconSize,selected:this.selected,title:this.title,extra:this.extra,disabled:this.mergedDisabled,icon:this.icon,onClick:this.handleClick})}))}}),po=Object.assign(Object.assign({},Fe),{tmNode:{type:Object,required:!0},tmNodes:{type:Array,required:!0}}),or=Ae(po),tr=$({name:"MenuOptionGroup",props:po,setup(e){const o=Le(e),{NSubmenu:t}=o,n=w(()=>t?.mergedDisabledRef.value?!0:e.tmNode.disabled);Q(je,{paddingLeftRef:o.paddingLeft,mergedDisabledRef:n});const{mergedClsPrefixRef:i,props:l}=Z(ve);return function(){const{value:d}=i,m=o.paddingLeft.value,{nodeProps:s}=l,p=s?.(e.tmNode.rawNode);return c("div",{class:`${d}-menu-item-group`,role:"group"},c("div",Object.assign({},p,{class:[`${d}-menu-item-group-title`,p?.class],style:[p?.style||"",m!==void 0?`padding-left: ${m}px;`:""]}),le(e.title),e.extra?c(io,null," ",le(e.extra)):null),c("div",null,e.tmNodes.map(P=>De(P,l))))}}});function Te(e){return e.type==="divider"||e.type==="render"}function rr(e){return e.type==="divider"}function De(e,o){const{rawNode:t}=e,{show:n}=t;if(n===!1)return null;if(Te(t))return rr(t)?c(Qt,Object.assign({key:e.key},t.props)):null;const{labelField:i}=o,{key:l,level:d,isGroup:m}=e,s=Object.assign(Object.assign({},t),{title:t.title||t[i],extra:t.titleExtra||t.extra,key:l,internalKey:l,level:d,root:d===0,isGroup:m});return e.children?e.isGroup?c(tr,Ie(s,or,{tmNode:e,tmNodes:e.children,key:l})):c(Ee,Ie(s,nr,{key:l,rawNodes:t[o.childrenField],tmNodes:e.children,tmNode:e})):c(er,Ie(s,Zt,{key:l,tmNode:e}))}const go=Object.assign(Object.assign({},Fe),{rawNodes:{type:Array,default:()=>[]},tmNodes:{type:Array,default:()=>[]},tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function,domId:String,virtualChildActive:{type:Boolean,default:void 0},isEllipsisPlaceholder:Boolean}),nr=Ae(go),Ee=$({name:"Submenu",props:go,setup(e){const o=Le(e),{NMenu:t,NSubmenu:n}=o,{props:i,mergedCollapsedRef:l,mergedThemeRef:d}=t,m=w(()=>{const{disabled:b}=e;return n?.mergedDisabledRef.value||i.disabled?!0:b}),s=F(!1);Q(vo,{paddingLeftRef:o.paddingLeft,mergedDisabledRef:m}),Q(je,null);function p(){const{onClick:b}=e;b&&b()}function P(){m.value||(l.value||t.toggleExpand(e.internalKey),p())}function B(b){s.value=b}return{menuProps:i,mergedTheme:d,doSelect:t.doSelect,inverted:t.invertedRef,isHorizontal:t.isHorizontalRef,mergedClsPrefix:t.mergedClsPrefixRef,maxIconSize:o.maxIconSize,activeIconSize:o.activeIconSize,iconMarginRight:o.iconMarginRight,dropdownPlacement:o.dropdownPlacement,dropdownShow:s,paddingLeft:o.paddingLeft,mergedDisabled:m,mergedValue:t.mergedValueRef,childActive:Be(()=>{var b;return(b=e.virtualChildActive)!==null&&b!==void 0?b:t.activePathRef.value.includes(e.internalKey)}),collapsed:w(()=>i.mode==="horizontal"?!1:l.value?!0:!t.mergedExpandedKeysRef.value.includes(e.internalKey)),dropdownEnabled:w(()=>!m.value&&(i.mode==="horizontal"||l.value)),handlePopoverShowChange:B,handleClick:P}},render(){var e;const{mergedClsPrefix:o,menuProps:{renderIcon:t,renderLabel:n}}=this,i=()=>{const{isHorizontal:d,paddingLeft:m,collapsed:s,mergedDisabled:p,maxIconSize:P,activeIconSize:B,title:b,childActive:T,icon:E,handleClick:I,menuProps:{nodeProps:C},dropdownShow:k,iconMarginRight:G,tmNode:W,mergedClsPrefix:K,isEllipsisPlaceholder:M,extra:h}=this,g=C?.(W.rawNode);return c("div",Object.assign({},g,{class:[`${K}-menu-item`,g?.class],role:"menuitem"}),c(mo,{tmNode:W,paddingLeft:m,collapsed:s,disabled:p,iconMarginRight:G,maxIconSize:P,activeIconSize:B,title:b,extra:h,showArrow:!d,childActive:T,clsPrefix:K,icon:E,hover:k,onClick:I,isEllipsisPlaceholder:M}))},l=()=>c(Xo,null,{default:()=>{const{tmNodes:d,collapsed:m}=this;return m?null:c("div",{class:`${o}-submenu-children`,role:"menu"},d.map(s=>De(s,this.menuProps)))}});return this.root?c(ao,Object.assign({size:"large",trigger:"hover"},(e=this.menuProps)===null||e===void 0?void 0:e.dropdownProps,{themeOverrides:this.mergedTheme.peerOverrides.Dropdown,theme:this.mergedTheme.peers.Dropdown,builtinThemeOverrides:{fontSizeLarge:"14px",optionIconSizeLarge:"18px"},value:this.mergedValue,disabled:!this.dropdownEnabled,placement:this.dropdownPlacement,keyField:this.menuProps.keyField,labelField:this.menuProps.labelField,childrenField:this.menuProps.childrenField,onUpdateShow:this.handlePopoverShowChange,options:this.rawNodes,onSelect:this.doSelect,inverted:this.inverted,renderIcon:t,renderLabel:n}),{default:()=>c("div",{class:`${o}-submenu`,role:"menu","aria-expanded":!this.collapsed,id:this.domId},i(),this.isHorizontal?null:l())}):c("div",{class:`${o}-submenu`,role:"menu","aria-expanded":!this.collapsed,id:this.domId},i(),l())}}),ir=Object.assign(Object.assign({},J.props),{options:{type:Array,default:()=>[]},collapsed:{type:Boolean,default:void 0},collapsedWidth:{type:Number,default:48},iconSize:{type:Number,default:20},collapsedIconSize:{type:Number,default:24},rootIndent:Number,indent:{type:Number,default:32},labelField:{type:String,default:"label"},keyField:{type:String,default:"key"},childrenField:{type:String,default:"children"},disabledField:{type:String,default:"disabled"},defaultExpandAll:Boolean,defaultExpandedKeys:Array,expandedKeys:Array,value:[String,Number],defaultValue:{type:[String,Number],default:null},mode:{type:String,default:"vertical"},watchProps:{type:Array,default:void 0},disabled:Boolean,show:{type:Boolean,default:!0},inverted:Boolean,"onUpdate:expandedKeys":[Function,Array],onUpdateExpandedKeys:[Function,Array],onUpdateValue:[Function,Array],"onUpdate:value":[Function,Array],expandIcon:Function,renderIcon:Function,renderLabel:Function,renderExtra:Function,dropdownProps:Object,accordion:Boolean,nodeProps:Function,dropdownPlacement:{type:String,default:"bottom"},responsive:Boolean,items:Array,onOpenNamesChange:[Function,Array],onSelect:[Function,Array],onExpandedNamesChange:[Function,Array],expandedNames:Array,defaultExpandedNames:Array}),lr=$({name:"Menu",inheritAttrs:!1,props:ir,setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:t}=ne(e),n=J("Menu","-menu",Jt,Jo,e,o),i=Z(co,null),l=w(()=>{var x;const{collapsed:R}=e;if(R!==void 0)return R;if(i){const{collapseModeRef:r,collapsedRef:S}=i;if(r.value==="width")return(x=S.value)!==null&&x!==void 0?x:!1}return!1}),d=w(()=>{const{keyField:x,childrenField:R,disabledField:r}=e;return Re(e.items||e.options,{getIgnored(S){return Te(S)},getChildren(S){return S[R]},getDisabled(S){return S[r]},getKey(S){var N;return(N=S[x])!==null&&N!==void 0?N:S.name}})}),m=w(()=>new Set(d.value.treeNodes.map(x=>x.key))),{watchProps:s}=e,p=F(null);s?.includes("defaultValue")?$e(()=>{p.value=e.defaultValue}):p.value=e.defaultValue;const P=re(e,"value"),B=he(P,p),b=F([]),T=()=>{b.value=e.defaultExpandAll?d.value.getNonLeafKeys():e.defaultExpandedNames||e.defaultExpandedKeys||d.value.getPath(B.value,{includeSelf:!1}).keyPath};s?.includes("defaultExpandedKeys")?$e(T):T();const E=vt(e,["expandedNames","expandedKeys"]),I=he(E,b),C=w(()=>d.value.treeNodes),k=w(()=>d.value.getPath(B.value).keyPath);Q(ve,{props:e,mergedCollapsedRef:l,mergedThemeRef:n,mergedValueRef:B,mergedExpandedKeysRef:I,activePathRef:k,mergedClsPrefixRef:o,isHorizontalRef:w(()=>e.mode==="horizontal"),invertedRef:re(e,"inverted"),doSelect:G,toggleExpand:K});function G(x,R){const{"onUpdate:value":r,onUpdateValue:S,onSelect:N}=e;S&&V(S,x,R),r&&V(r,x,R),N&&V(N,x,R),p.value=x}function W(x){const{"onUpdate:expandedKeys":R,onUpdateExpandedKeys:r,onExpandedNamesChange:S,onOpenNamesChange:N}=e;R&&V(R,x),r&&V(r,x),S&&V(S,x),N&&V(N,x),b.value=x}function K(x){const R=Array.from(I.value),r=R.findIndex(S=>S===x);if(~r)R.splice(r,1);else{if(e.accordion&&m.value.has(x)){const S=R.findIndex(N=>m.value.has(N));S>-1&&R.splice(S,1)}R.push(x)}W(R)}const M=x=>{const R=d.value.getPath(x??B.value,{includeSelf:!1}).keyPath;if(!R.length)return;const r=Array.from(I.value),S=new Set([...r,...R]);e.accordion&&m.value.forEach(N=>{S.has(N)&&!R.includes(N)&&S.delete(N)}),W(Array.from(S))},h=w(()=>{const{inverted:x}=e,{common:{cubicBezierEaseInOut:R},self:r}=n.value,{borderRadius:S,borderColorHorizontal:N,fontSize:ze,itemHeight:Se,dividerColor:_e}=r,a={"--n-divider-color":_e,"--n-bezier":R,"--n-font-size":ze,"--n-border-color-horizontal":N,"--n-border-radius":S,"--n-item-height":Se};return x?(a["--n-group-text-color"]=r.groupTextColorInverted,a["--n-color"]=r.colorInverted,a["--n-item-text-color"]=r.itemTextColorInverted,a["--n-item-text-color-hover"]=r.itemTextColorHoverInverted,a["--n-item-text-color-active"]=r.itemTextColorActiveInverted,a["--n-item-text-color-child-active"]=r.itemTextColorChildActiveInverted,a["--n-item-text-color-child-active-hover"]=r.itemTextColorChildActiveInverted,a["--n-item-text-color-active-hover"]=r.itemTextColorActiveHoverInverted,a["--n-item-icon-color"]=r.itemIconColorInverted,a["--n-item-icon-color-hover"]=r.itemIconColorHoverInverted,a["--n-item-icon-color-active"]=r.itemIconColorActiveInverted,a["--n-item-icon-color-active-hover"]=r.itemIconColorActiveHoverInverted,a["--n-item-icon-color-child-active"]=r.itemIconColorChildActiveInverted,a["--n-item-icon-color-child-active-hover"]=r.itemIconColorChildActiveHoverInverted,a["--n-item-icon-color-collapsed"]=r.itemIconColorCollapsedInverted,a["--n-item-text-color-horizontal"]=r.itemTextColorHorizontalInverted,a["--n-item-text-color-hover-horizontal"]=r.itemTextColorHoverHorizontalInverted,a["--n-item-text-color-active-horizontal"]=r.itemTextColorActiveHorizontalInverted,a["--n-item-text-color-child-active-horizontal"]=r.itemTextColorChildActiveHorizontalInverted,a["--n-item-text-color-child-active-hover-horizontal"]=r.itemTextColorChildActiveHoverHorizontalInverted,a["--n-item-text-color-active-hover-horizontal"]=r.itemTextColorActiveHoverHorizontalInverted,a["--n-item-icon-color-horizontal"]=r.itemIconColorHorizontalInverted,a["--n-item-icon-color-hover-horizontal"]=r.itemIconColorHoverHorizontalInverted,a["--n-item-icon-color-active-horizontal"]=r.itemIconColorActiveHorizontalInverted,a["--n-item-icon-color-active-hover-horizontal"]=r.itemIconColorActiveHoverHorizontalInverted,a["--n-item-icon-color-child-active-horizontal"]=r.itemIconColorChildActiveHorizontalInverted,a["--n-item-icon-color-child-active-hover-horizontal"]=r.itemIconColorChildActiveHoverHorizontalInverted,a["--n-arrow-color"]=r.arrowColorInverted,a["--n-arrow-color-hover"]=r.arrowColorHoverInverted,a["--n-arrow-color-active"]=r.arrowColorActiveInverted,a["--n-arrow-color-active-hover"]=r.arrowColorActiveHoverInverted,a["--n-arrow-color-child-active"]=r.arrowColorChildActiveInverted,a["--n-arrow-color-child-active-hover"]=r.arrowColorChildActiveHoverInverted,a["--n-item-color-hover"]=r.itemColorHoverInverted,a["--n-item-color-active"]=r.itemColorActiveInverted,a["--n-item-color-active-hover"]=r.itemColorActiveHoverInverted,a["--n-item-color-active-collapsed"]=r.itemColorActiveCollapsedInverted):(a["--n-group-text-color"]=r.groupTextColor,a["--n-color"]=r.color,a["--n-item-text-color"]=r.itemTextColor,a["--n-item-text-color-hover"]=r.itemTextColorHover,a["--n-item-text-color-active"]=r.itemTextColorActive,a["--n-item-text-color-child-active"]=r.itemTextColorChildActive,a["--n-item-text-color-child-active-hover"]=r.itemTextColorChildActiveHover,a["--n-item-text-color-active-hover"]=r.itemTextColorActiveHover,a["--n-item-icon-color"]=r.itemIconColor,a["--n-item-icon-color-hover"]=r.itemIconColorHover,a["--n-item-icon-color-active"]=r.itemIconColorActive,a["--n-item-icon-color-active-hover"]=r.itemIconColorActiveHover,a["--n-item-icon-color-child-active"]=r.itemIconColorChildActive,a["--n-item-icon-color-child-active-hover"]=r.itemIconColorChildActiveHover,a["--n-item-icon-color-collapsed"]=r.itemIconColorCollapsed,a["--n-item-text-color-horizontal"]=r.itemTextColorHorizontal,a["--n-item-text-color-hover-horizontal"]=r.itemTextColorHoverHorizontal,a["--n-item-text-color-active-horizontal"]=r.itemTextColorActiveHorizontal,a["--n-item-text-color-child-active-horizontal"]=r.itemTextColorChildActiveHorizontal,a["--n-item-text-color-child-active-hover-horizontal"]=r.itemTextColorChildActiveHoverHorizontal,a["--n-item-text-color-active-hover-horizontal"]=r.itemTextColorActiveHoverHorizontal,a["--n-item-icon-color-horizontal"]=r.itemIconColorHorizontal,a["--n-item-icon-color-hover-horizontal"]=r.itemIconColorHoverHorizontal,a["--n-item-icon-color-active-horizontal"]=r.itemIconColorActiveHorizontal,a["--n-item-icon-color-active-hover-horizontal"]=r.itemIconColorActiveHoverHorizontal,a["--n-item-icon-color-child-active-horizontal"]=r.itemIconColorChildActiveHorizontal,a["--n-item-icon-color-child-active-hover-horizontal"]=r.itemIconColorChildActiveHoverHorizontal,a["--n-arrow-color"]=r.arrowColor,a["--n-arrow-color-hover"]=r.arrowColorHover,a["--n-arrow-color-active"]=r.arrowColorActive,a["--n-arrow-color-active-hover"]=r.arrowColorActiveHover,a["--n-arrow-color-child-active"]=r.arrowColorChildActive,a["--n-arrow-color-child-active-hover"]=r.arrowColorChildActiveHover,a["--n-item-color-hover"]=r.itemColorHover,a["--n-item-color-active"]=r.itemColorActive,a["--n-item-color-active-hover"]=r.itemColorActiveHover,a["--n-item-color-active-collapsed"]=r.itemColorActiveCollapsed),a}),g=t?ae("menu",w(()=>e.inverted?"a":"b"),h,e):void 0,A=qo(),z=F(null),j=F(null);let O=!0;const L=()=>{var x;O?O=!1:(x=z.value)===null||x===void 0||x.sync({showAllItemsBeforeCalculate:!0})};function Y(){return document.getElementById(A)}const ie=F(-1);function be(x){ie.value=e.options.length-x}function xe(x){x||(ie.value=-1)}const we=w(()=>{const x=ie.value;return{children:x===-1?[]:e.options.slice(x)}}),Ce=w(()=>{const{childrenField:x,disabledField:R,keyField:r}=e;return Re([we.value],{getIgnored(S){return Te(S)},getChildren(S){return S[x]},getDisabled(S){return S[R]},getKey(S){var N;return(N=S[r])!==null&&N!==void 0?N:S.name}})}),ye=w(()=>Re([{}]).treeNodes[0]);function ke(){var x;if(ie.value===-1)return c(Ee,{root:!0,level:0,key:"__ellpisisGroupPlaceholder__",internalKey:"__ellpisisGroupPlaceholder__",title:"···",tmNode:ye.value,domId:A,isEllipsisPlaceholder:!0});const R=Ce.value.treeNodes[0],r=k.value,S=!!(!((x=R.children)===null||x===void 0)&&x.some(N=>r.includes(N.key)));return c(Ee,{level:0,root:!0,key:"__ellpisisGroup__",internalKey:"__ellpisisGroup__",title:"···",virtualChildActive:S,tmNode:R,domId:A,rawNodes:R.rawNode.children||[],tmNodes:R.children||[],isEllipsisPlaceholder:!0})}return{mergedClsPrefix:o,controlledExpandedKeys:E,uncontrolledExpanededKeys:b,mergedExpandedKeys:I,uncontrolledValue:p,mergedValue:B,activePath:k,tmNodes:C,mergedTheme:n,mergedCollapsed:l,cssVars:t?void 0:h,themeClass:g?.themeClass,overflowRef:z,counterRef:j,updateCounter:()=>{},onResize:L,onUpdateOverflow:xe,onUpdateCount:be,renderCounter:ke,getCounter:Y,onRender:g?.onRender,showOption:M,deriveResponsiveState:L}},render(){const{mergedClsPrefix:e,mode:o,themeClass:t,onRender:n}=this;n?.();const i=()=>this.tmNodes.map(s=>De(s,this.$props)),d=o==="horizontal"&&this.responsive,m=()=>c("div",oo(this.$attrs,{role:o==="horizontal"?"menubar":"menu",class:[`${e}-menu`,t,`${e}-menu--${o}`,d&&`${e}-menu--responsive`,this.mergedCollapsed&&`${e}-menu--collapsed`],style:this.cssVars}),d?c(ht,{ref:"overflowRef",onUpdateOverflow:this.onUpdateOverflow,getCounter:this.getCounter,onUpdateCount:this.onUpdateCount,updateCounter:this.updateCounter,style:{width:"100%",display:"flex",overflow:"hidden"}},{default:i,counter:this.renderCounter}):i());return d?c(Go,{onResize:this.onResize},{default:m}):m()}}),ar={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},sr=$({name:"BusinessOutline",render:function(o,t){return H(),D("svg",ar,t[0]||(t[0]=[ge('<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M176 416v64"></path><path d="M80 32h192a32 32 0 0 1 32 32v412a4 4 0 0 1-4 4H48h0V64a32 32 0 0 1 32-32z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path><path d="M320 192h112a32 32 0 0 1 32 32v256h0h-160h0V208a16 16 0 0 1 16-16z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path><path d="M98.08 431.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 351.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 271.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 191.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 111.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 351.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 271.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 191.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 111.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M258.08 431.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M258.08 351.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M258.08 271.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><ellipse cx="256" cy="176" rx="15.95" ry="16.03" transform="rotate(-45 255.99 175.996)" fill="currentColor"></ellipse><path d="M258.08 111.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M400 400a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M400 320a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M400 240a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M336 400a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M336 320a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M336 240a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path>',23)]))}}),cr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},dr=$({name:"CalendarOutline",render:function(o,t){return H(),D("svg",cr,t[0]||(t[0]=[ge('<rect fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" x="48" y="80" width="416" height="384" rx="48"></rect><circle cx="296" cy="232" r="24" fill="currentColor"></circle><circle cx="376" cy="232" r="24" fill="currentColor"></circle><circle cx="296" cy="312" r="24" fill="currentColor"></circle><circle cx="376" cy="312" r="24" fill="currentColor"></circle><circle cx="136" cy="312" r="24" fill="currentColor"></circle><circle cx="216" cy="312" r="24" fill="currentColor"></circle><circle cx="136" cy="392" r="24" fill="currentColor"></circle><circle cx="216" cy="392" r="24" fill="currentColor"></circle><circle cx="296" cy="392" r="24" fill="currentColor"></circle><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" stroke-linecap="round" d="M128 48v32"></path><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" stroke-linecap="round" d="M384 48v32"></path><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" d="M464 160H48"></path>',13)]))}}),ur={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},hr=$({name:"CartOutline",render:function(o,t){return H(),D("svg",ur,t[0]||(t[0]=[y("circle",{cx:"176",cy:"416",r:"16",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("circle",{cx:"400",cy:"416",r:"16",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M48 80h64l48 272h256"},null,-1),y("path",{d:"M160 288h249.44a8 8 0 0 0 7.85-6.43l28.8-144a8 8 0 0 0-7.85-9.57H128",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),vr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},bo=$({name:"CheckmarkOutline",render:function(o,t){return H(),D("svg",vr,t[0]||(t[0]=[y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M416 128L192 384l-96-96"},null,-1)]))}}),mr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},fr=$({name:"ContrastOutline",render:function(o,t){return H(),D("svg",mr,t[0]||(t[0]=[y("circle",{cx:"256",cy:"256",r:"208",fill:"none",stroke:"currentColor","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M256 464c-114.88 0-208-93.12-208-208S141.12 48 256 48z",fill:"currentColor"},null,-1)]))}}),pr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Je=$({name:"CubeOutline",render:function(o,t){return H(),D("svg",pr,t[0]||(t[0]=[y("path",{d:"M448 341.37V170.61A32 32 0 0 0 432.11 143l-152-88.46a47.94 47.94 0 0 0-48.24 0L79.89 143A32 32 0 0 0 64 170.61v170.76A32 32 0 0 0 79.89 369l152 88.46a48 48 0 0 0 48.24 0l152-88.46A32 32 0 0 0 448 341.37z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M69 153.99l187 110l187-110"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M256 463.99v-200"},null,-1)]))}}),gr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},br=$({name:"DocumentTextOutline",render:function(o,t){return H(),D("svg",gr,t[0]||(t[0]=[y("path",{d:"M416 221.25V416a48 48 0 0 1-48 48H144a48 48 0 0 1-48-48V96a48 48 0 0 1 48-48h98.75a32 32 0 0 1 22.62 9.37l141.26 141.26a32 32 0 0 1 9.37 22.62z",fill:"none",stroke:"currentColor","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M256 56v120a32 32 0 0 0 32 32h120",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M176 288h160"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M176 368h160"},null,-1)]))}}),xr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Qe=$({name:"FolderOpenOutline",render:function(o,t){return H(),D("svg",xr,t[0]||(t[0]=[y("path",{d:"M64 192v-72a40 40 0 0 1 40-40h75.89a40 40 0 0 1 22.19 6.72l27.84 18.56a40 40 0 0 0 22.19 6.72H408a40 40 0 0 1 40 40v40",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M479.9 226.55L463.68 392a40 40 0 0 1-39.93 40H88.25a40 40 0 0 1-39.93-40L32.1 226.55A32 32 0 0 1 64 192h384.1a32 32 0 0 1 31.8 34.55z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),wr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Cr=$({name:"GridOutline",render:function(o,t){return H(),D("svg",wr,t[0]||(t[0]=[y("rect",{x:"48",y:"48",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("rect",{x:"288",y:"48",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("rect",{x:"48",y:"288",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("rect",{x:"288",y:"288",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),yr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},kr=$({name:"LibraryOutline",render:function(o,t){return H(),D("svg",yr,t[0]||(t[0]=[ge('<rect x="32" y="96" width="64" height="368" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 224h128"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 400h128"></path><rect x="112" y="160" width="128" height="304" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><rect x="256" y="48" width="96" height="416" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><path d="M422.46 96.11l-40.4 4.25c-11.12 1.17-19.18 11.57-17.93 23.1l34.92 321.59c1.26 11.53 11.37 20 22.49 18.84l40.4-4.25c11.12-1.17 19.18-11.57 17.93-23.1L445 115c-1.31-11.58-11.42-20.06-22.54-18.89z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></path>',6)]))}}),zr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Sr=$({name:"LogOutOutline",render:function(o,t){return H(),D("svg",zr,t[0]||(t[0]=[y("path",{d:"M304 336v40a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V136a40 40 0 0 1 40-40h152c22.09 0 48 17.91 48 40v40",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M368 336l80-80l-80-80"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M176 256h256"},null,-1)]))}}),_r={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Ir=$({name:"MenuOutline",render:function(o,t){return H(),D("svg",_r,t[0]||(t[0]=[y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 160h352"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 256h352"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 352h352"},null,-1)]))}}),Rr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},xo=$({name:"MoonOutline",render:function(o,t){return H(),D("svg",Rr,t[0]||(t[0]=[y("path",{d:"M160 136c0-30.62 4.51-61.61 16-88C99.57 81.27 48 159.32 48 248c0 119.29 96.71 216 216 216c88.68 0 166.73-51.57 200-128c-26.39 11.49-57.38 16-88 16c-119.29 0-216-96.71-216-216z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),Mr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},$r=$({name:"SettingsOutline",render:function(o,t){return H(),D("svg",Mr,t[0]||(t[0]=[y("path",{d:"M262.29 192.31a64 64 0 1 0 57.4 57.4a64.13 64.13 0 0 0-57.4-57.4zM416.39 256a154.34 154.34 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.48 164.48 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22a155.3 155.3 0 0 1-21.46-12.57a16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.48 164.48 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22a155.3 155.3 0 0 1 21.46 12.57a16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0-6.05 14.08c.33 4.14.55 8.3.55 12.47z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),Br={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},wo=$({name:"SunnyOutline",render:function(o,t){return H(),D("svg",Br,t[0]||(t[0]=[ge('<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 48v48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 416v48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 108.92l-33.94 33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 369.14l-33.94 33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M464 256h-48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M96 256H48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 403.08l-33.94-33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 142.86l-33.94-33.94"></path><circle cx="256" cy="256" r="80" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"></circle>',9)]))}}),Or={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Tr=$({name:"WarningOutline",render:function(o,t){return H(),D("svg",Or,t[0]||(t[0]=[y("path",{d:"M85.57 446.25h340.86a32 32 0 0 0 28.17-47.17L284.18 82.58c-12.09-22.44-44.27-22.44-56.36 0L57.4 399.08a32 32 0 0 0 28.17 47.17z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M250.26 195.39l5.74 122l5.73-121.95a5.74 5.74 0 0 0-5.79-6h0a5.74 5.74 0 0 0-5.68 5.95z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M256 397.25a20 20 0 1 1 20-20a20 20 0 0 1-20 20z",fill:"currentColor"},null,-1)]))}}),Er={auto:"自动",light:"浅色",dark:"深色"},Pr={auto:fr,light:wo,dark:xo},Ar="外观",Nr="theme-menu";function Hr(e){return lo.includes(e)}function jr(e,o,t){return[{label:Ar,key:Nr,icon:t(o?xo:wo),children:lo.map(n=>({key:n,label:Er[n],icon:t(n===e?bo:Pr[n])}))}]}const te=e=>()=>c(Oe,null,{default:()=>c(e)});function Lr(e){const o=(i,l,d)=>({label:()=>c(Qo,{to:{name:l},onClick:e.onNavigate},{default:()=>i}),key:l,...d?{icon:te(d)}:{}}),n=[{key:"dashboard",build:()=>o("工作台","dashboard",Cr)},{key:"memos",build:()=>o("备忘录","memos",br)},{key:"warehouse",build:()=>e.isLiteMode?o("二级库","warehouse-lite",Je):{label:"二级库",key:"warehouse-group",icon:te(Je),children:[o("库存查询","stock"),o("物资档案","stock-materials"),o("操作记录","operations"),...e.can("warehouse:write")?[o("入库","inbound"),o("出库","outbound")]:[]]}},{key:"huaxing_inventory",build:()=>o("华星总库存","hua-xing-stock",sr)},{key:"procurement",build:()=>({label:"申购管理",key:"procurement-group",icon:te(hr),children:[o("申购计划","purchase-materials"),o("周期性计划","purchase-plan-templates"),o("未编码物资","uncoded-materials"),o("物料编码库","material-code-library"),o("申购记录","purchase-records")]})},{key:"hazards",build:()=>({label:"隐患管理",key:"hazard-group",icon:te(Tr),children:[o("隐患管理","hazard-records"),o("隐患类型","hazard-types"),o("责任单位","hazard-units")]})},{key:"ledger",build:()=>({label:"台账管理",key:"ledger-group",icon:te(kr),children:[o("台账总览","ledger-items"),o("标签管理","ledger-tags")]})},{key:"work",build:()=>({label:"工作管理",key:"work-group",icon:te(dr),children:[o("工作总览","work-overview"),o("任务视图","work-tasks"),o("人员视图","work-workers")]})}].filter(i=>e.isFeatureVisible(i.key)).map(i=>i.build());return e.can("settings:write")&&n.push({label:"系统管理",key:"settings-group",icon:te($r),children:[o("管理端用户","users"),o("小程序用户","mini-program-users"),o("项目管理","projects"),o("附件管理","attachments"),o("高级设置","advanced-settings"),o("分享链接","share-links"),o("关于","about")]}),n}const Fr="project-menu",Dr="项目：",Ke="project:",Kr="project:none",Ur="暂无可用项目";function Co(e){return e.startsWith(Ke)}function Vr(e){if(!Co(e))return null;const o=Number(e.slice(Ke.length));return Number.isInteger(o)&&o>0?o:null}function Ze(e){return e.name?.trim()||"未命名项目"}function Wr(e,o,t){const n=e.find(i=>i.id===o)??null;return[{label:`${Dr}${n?Ze(n):"未选择"}`,key:Fr,icon:t(Qe),children:e.length?e.map(i=>({key:`${Ke}${i.id}`,label:Ze(i),icon:t(i.id===o?bo:Qe)})):[{key:Kr,label:Ur,disabled:!0}]}]}const Yr=["src"],Xr={key:0},Gr={class:"topbar-left"},qr={class:"topbar-title"},Jr={class:"topbar-actions"},Qr={type:"button",class:"user-menu-trigger","aria-label":"打开用户菜单"},Zr={class:"user-summary"},en={class:"user-name"},on={key:0,class:"user-role"},tn={class:"drawer-brand"},rn=["src"],nn=$({__name:"AppLayout",setup(e){const o=at(),t=ct(),n=Zo(),i=et(),l=ot(),d=tt(),m=F(!1),s=rt("(max-width: 768px)"),p=F(!1),P=()=>{p.value=!1},B=C=>()=>c(Oe,null,{default:()=>c(C)}),b=w(()=>Lr({isLiteMode:l.isLiteMode,can:C=>n.can(C),isFeatureVisible:C=>l.isFeatureVisible(C),onNavigate:P}));function T(){n.logout(),i.clear(),t.push({name:"login"})}const E=w(()=>[...jr(d.mode,d.isDark,B),...Wr(i.enabledProjects,i.currentProject?.id??null,B),{type:"divider",key:"logout-divider"},{label:"退出登录",key:"logout",icon:B(Sr)}]);function I(C){if(C==="logout"){T();return}if(Hr(C)){d.setMode(C);return}if(Co(C)){const k=Vr(C);k!==null&&i.select(k)}}return(C,k)=>{const G=lr,W=qt,K=Ct,M=bt,h=ao,g=Vt,A=st("router-view"),z=Dt,j=Ft,O=Nt;return H(),D(io,null,[X(j,{"has-sider":!U(s),class:"app-shell"},{default:q(()=>[U(s)?ee("",!0):(H(),de(W,{key:0,bordered:"","collapse-mode":"width","collapsed-width":64,width:180,collapsed:m.value,"show-trigger":"",onCollapse:k[0]||(k[0]=L=>m.value=!0),onExpand:k[1]||(k[1]=L=>m.value=!1)},{default:q(()=>[y("div",{class:nt(["brand",{compact:m.value}])},[y("img",{class:"brand-mark",src:U(Xe),alt:"系统 Logo"},null,8,Yr),m.value?ee("",!0):(H(),D("span",Xr,"HXNI 电气无忧"))],2),X(G,{collapsed:m.value,"collapsed-width":64,"collapsed-icon-size":22,options:b.value,value:String(U(o).name||"")},null,8,["collapsed","options","value"])]),_:1},8,["collapsed"])),X(j,null,{default:q(()=>[X(g,{bordered:"",class:"topbar"},{default:q(()=>[y("div",Gr,[U(s)?(H(),D("button",{key:0,type:"button",class:"menu-toggle","aria-label":"打开导航菜单",onClick:k[2]||(k[2]=L=>p.value=!0)},[X(U(Oe),{size:20},{default:q(()=>[X(U(Ir))]),_:1})])):ee("",!0),y("div",qr,[X(M,null,{default:q(()=>[!U(s)&&U(o).meta.parent?(H(),de(K,{key:0},{default:q(()=>[We(me(U(o).meta.parent),1)]),_:1})):ee("",!0),X(K,null,{default:q(()=>[We(me(U(o).meta.title),1)]),_:1})]),_:1})])]),y("div",Jr,[X(h,{options:E.value,onSelect:I},{default:q(()=>[y("button",Qr,[y("span",Zr,[y("span",en,me(U(n).user?.display_name||U(n).user?.username),1),U(s)?ee("",!0):(H(),D("span",on,me(U(n).user?U(it)[U(n).user.role]:""),1))]),k[4]||(k[4]=y("span",{class:"user-menu-caret","aria-hidden":"true"},null,-1))])]),_:1},8,["options"])])]),_:1}),X(z,{class:"app-content","native-scrollbar":!1},{default:q(()=>[X(A,null,{default:q(({Component:L,route:Y})=>[(H(),de(lt,null,[Y.meta.keepAlive?(H(),de(Ye(L),{key:String(Y.name)})):ee("",!0)],1024)),Y.meta.keepAlive?ee("",!0):(H(),de(Ye(L),{key:0}))]),_:1})]),_:1})]),_:1})]),_:1},8,["has-sider"]),X(O,{show:p.value,"onUpdate:show":k[3]||(k[3]=L=>p.value=L),placement:"left",width:250,"aria-label":"导航菜单"},{default:q(()=>[y("div",tn,[y("img",{class:"brand-mark",src:U(Xe),alt:"系统 Logo"},null,8,rn),k[5]||(k[5]=y("span",null,"HXNI 电气无忧",-1))]),X(G,{class:"drawer-menu",options:b.value,value:String(U(o).name||""),"onUpdate:value":P},null,8,["options","value"])]),_:1},8,["show"])],64)}}}),fn=mt(nn,[["__scopeId","data-v-98fd888f"]]);export{fn as default};
