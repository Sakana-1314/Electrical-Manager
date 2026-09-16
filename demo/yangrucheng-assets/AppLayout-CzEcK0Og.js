import{d as T,l as d,m,n as u,p as S,q as p,s as ne,t as J,v as le,x as Ct,y as C,z as ae,A as Q,C as re,r as D,D as yt,E as kt,F as zt,G as St,H as ee,I as Ie,J as _t,T as Ze,K as et,S as Be,L as De,M as It,N as Re,O as Rt,P as Mt,Q as $t,R as tt,U as Tt,V as Bt,W as Ot,X as Et,Y as fe,Z as Pt,$ as At,a0 as Nt,a1 as Ht,a2 as Lt,a3 as jt,a4 as W,a5 as Ft,a6 as Dt,a7 as Kt,a8 as Ut,a9 as Ke,aa as ot,ab as rt,ac as se,ad as Vt,ae as ie,af as Oe,ag as Me,ah as nt,ai as Se,aj as Wt,ak as Yt,al as Xt,am as Gt,o as L,c as U,an as Ee,a as y,ao as it,u as qt,ap as Jt,aq as Qt,ar as Zt,as as eo,f as G,w as q,b as K,at as ce,au as te,av as to,e as Ue,aw as me,ax as oo,ay as Ve,az as ro,h as no,aA as io,g as lo,aB as ao}from"./index-BDXvMQEj.js";import{L as We}from"./branding-BOlZagxP.js";import{u as ue,f as de}from"./get-KC8MG7tb.js";import{N as so}from"./Tooltip-D0KwGkOK.js";import{N as lt}from"./Dropdown-ChKXqw_8.js";import{V as co,c as _e}from"./create-Bg_XWjCL.js";import{u as uo}from"./use-compitable-Cp2lLBEn.js";import{C as ho}from"./ChevronRight-B5umcNMq.js";import{N as Ye}from"./Icon-CQw4xd8O.js";import{_ as mo}from"./_plugin-vue_export-helper-DlAUqK2U.js";import"./Popover-0APPIHAn.js";import"./use-keyboard-Ca1IjecK.js";const vo=T({name:"ChevronDownFilled",render(){return d("svg",{viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg"},d("path",{d:"M3.20041 5.73966C3.48226 5.43613 3.95681 5.41856 4.26034 5.70041L8 9.22652L11.7397 5.70041C12.0432 5.41856 12.5177 5.43613 12.7996 5.73966C13.0815 6.0432 13.0639 6.51775 12.7603 6.7996L8.51034 10.7996C8.22258 11.0668 7.77743 11.0668 7.48967 10.7996L3.23966 6.7996C2.93613 6.51775 2.91856 6.0432 3.20041 5.73966Z",fill:"currentColor"}))}}),fo=m("breadcrumb",`
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
 `),m("breadcrumb-item",`
 font-size: var(--n-font-size);
 transition: color .3s var(--n-bezier);
 display: inline-flex;
 align-items: center;
 `,[m("icon",`
 font-size: 18px;
 vertical-align: -.2em;
 transition: color .3s var(--n-bezier);
 color: var(--n-item-text-color);
 `),u("&:not(:last-child)",[S("clickable",[p("link",`
 cursor: pointer;
 `,[u("&:hover",`
 background-color: var(--n-item-color-hover);
 `),u("&:active",`
 background-color: var(--n-item-color-pressed); 
 `)])])]),p("link",`
 padding: 4px;
 border-radius: var(--n-item-border-radius);
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 color: var(--n-item-text-color);
 position: relative;
 `,[u("&:hover",`
 color: var(--n-item-text-color-hover);
 `,[m("icon",`
 color: var(--n-item-text-color-hover);
 `)]),u("&:active",`
 color: var(--n-item-text-color-pressed);
 `,[m("icon",`
 color: var(--n-item-text-color-pressed);
 `)])]),p("separator",`
 margin: 0 8px;
 color: var(--n-separator-color);
 transition: color .3s var(--n-bezier);
 user-select: none;
 -webkit-user-select: none;
 `),u("&:last-child",[p("link",`
 font-weight: var(--n-font-weight-active);
 cursor: unset;
 color: var(--n-item-text-color-active);
 `,[m("icon",`
 color: var(--n-item-text-color-active);
 `)]),p("separator",`
 display: none;
 `)])])]),at=ae("n-breadcrumb"),po=Object.assign(Object.assign({},J.props),{separator:{type:String,default:"/"}}),go=T({name:"Breadcrumb",props:po,setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:t}=ne(e),n=J("Breadcrumb","-breadcrumb",fo,Ct,e,o);Q(at,{separatorRef:re(e,"separator"),mergedClsPrefixRef:o});const i=C(()=>{const{common:{cubicBezierEaseInOut:v},self:{separatorColor:f,itemTextColor:c,itemTextColorHover:g,itemTextColorPressed:A,itemTextColorActive:_,fontSize:s,fontWeightActive:O,itemBorderRadius:E,itemColorHover:I,itemColorPressed:$,itemLineHeight:w}}=n.value;return{"--n-font-size":s,"--n-bezier":v,"--n-item-text-color":c,"--n-item-text-color-hover":g,"--n-item-text-color-pressed":A,"--n-item-text-color-active":_,"--n-separator-color":f,"--n-item-color-hover":I,"--n-item-color-pressed":$,"--n-item-border-radius":E,"--n-font-weight-active":O,"--n-item-line-height":w}}),l=t?le("breadcrumb",void 0,i,e):void 0;return{mergedClsPrefix:o,cssVars:t?void 0:i,themeClass:l?.themeClass,onRender:l?.onRender}},render(){var e;return(e=this.onRender)===null||e===void 0||e.call(this),d("nav",{class:[`${this.mergedClsPrefix}-breadcrumb`,this.themeClass],style:this.cssVars,"aria-label":"Breadcrumb"},d("ul",null,this.$slots))}});function bo(e=zt?window:null){const o=()=>{const{hash:i,host:l,hostname:v,href:f,origin:c,pathname:g,port:A,protocol:_,search:s}=e?.location||{};return{hash:i,host:l,hostname:v,href:f,origin:c,pathname:g,port:A,protocol:_,search:s}},t=D(o()),n=()=>{t.value=o()};return yt(()=>{e&&(e.addEventListener("popstate",n),e.addEventListener("hashchange",n))}),kt(()=>{e&&(e.removeEventListener("popstate",n),e.removeEventListener("hashchange",n))}),t}const xo={separator:String,href:String,clickable:{type:Boolean,default:!0},showSeparator:{type:Boolean,default:!0},onClick:Function},wo=T({name:"BreadcrumbItem",props:xo,slots:Object,setup(e,{slots:o}){const t=ee(at,null);if(!t)return()=>null;const{separatorRef:n,mergedClsPrefixRef:i}=t,l=bo(),v=C(()=>e.href?"a":"span"),f=C(()=>l.value.href===e.href?"location":null);return()=>{const{value:c}=i;return d("li",{class:[`${c}-breadcrumb-item`,e.clickable&&`${c}-breadcrumb-item--clickable`]},d(v.value,{class:`${c}-breadcrumb-item__link`,"aria-current":f.value,href:e.href,onClick:e.onClick},o),e.showSeparator&&d("span",{class:`${c}-breadcrumb-item__separator`,"aria-hidden":"true"},St(o.separator,()=>{var g;return[(g=e.separator)!==null&&g!==void 0?g:n.value]})))}}}),Co=T({name:"NDrawerContent",inheritAttrs:!1,props:{blockScroll:Boolean,show:{type:Boolean,default:void 0},displayDirective:{type:String,required:!0},placement:{type:String,required:!0},contentClass:String,contentStyle:[Object,String],nativeScrollbar:{type:Boolean,required:!0},scrollbarProps:Object,trapFocus:{type:Boolean,default:!0},autoFocus:{type:Boolean,default:!0},showMask:{type:[Boolean,String],required:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,onClickoutside:Function,onAfterLeave:Function,onAfterEnter:Function,onEsc:Function},setup(e){const o=D(!!e.show),t=D(null),n=ee(tt);let i=0,l="",v=null;const f=D(!1),c=D(!1),g=C(()=>e.placement==="top"||e.placement==="bottom"),{mergedClsPrefixRef:A,mergedRtlRef:_}=ne(e),s=It("Drawer",_,A),O=h,E=k=>{c.value=!0,i=g.value?k.clientY:k.clientX,l=document.body.style.cursor,document.body.style.cursor=g.value?"ns-resize":"ew-resize",document.body.addEventListener("mousemove",R),document.body.addEventListener("mouseleave",O),document.body.addEventListener("mouseup",h)},I=()=>{v!==null&&(window.clearTimeout(v),v=null),c.value?f.value=!0:v=window.setTimeout(()=>{f.value=!0},300)},$=()=>{v!==null&&(window.clearTimeout(v),v=null),f.value=!1},{doUpdateHeight:w,doUpdateWidth:P}=n,F=k=>{const{maxWidth:j}=e;if(j&&k>j)return j;const{minWidth:B}=e;return B&&k<B?B:k},V=k=>{const{maxHeight:j}=e;if(j&&k>j)return j;const{minHeight:B}=e;return B&&k<B?B:k};function R(k){var j,B;if(c.value)if(g.value){let X=((j=t.value)===null||j===void 0?void 0:j.offsetHeight)||0;const Y=i-k.clientY;X+=e.placement==="bottom"?Y:-Y,X=V(X),w(X),i=k.clientY}else{let X=((B=t.value)===null||B===void 0?void 0:B.offsetWidth)||0;const Y=i-k.clientX;X+=e.placement==="right"?Y:-Y,X=F(X),P(X),i=k.clientX}}function h(){c.value&&(i=0,c.value=!1,document.body.style.cursor=l,document.body.removeEventListener("mousemove",R),document.body.removeEventListener("mouseup",h),document.body.removeEventListener("mouseleave",O))}Re(()=>{e.show&&(o.value=!0)}),Rt(()=>e.show,k=>{k||h()}),Mt(()=>{h()});const b=C(()=>{const{show:k}=e,j=[[De,k]];return e.showMask||j.push([Tt,e.onClickoutside,void 0,{capture:!0}]),j});function N(){var k;o.value=!1,(k=e.onAfterLeave)===null||k===void 0||k.call(e)}return $t(C(()=>e.blockScroll&&o.value)),Q(Bt,t),Q(Ot,null),Q(Et,null),{bodyRef:t,rtlEnabled:s,mergedClsPrefix:n.mergedClsPrefixRef,isMounted:n.isMountedRef,mergedTheme:n.mergedThemeRef,displayed:o,transitionName:C(()=>({right:"slide-in-from-right-transition",left:"slide-in-from-left-transition",top:"slide-in-from-top-transition",bottom:"slide-in-from-bottom-transition"})[e.placement]),handleAfterLeave:N,bodyDirectives:b,handleMousedownResizeTrigger:E,handleMouseenterResizeTrigger:I,handleMouseleaveResizeTrigger:$,isDragging:c,isHoverOnResizeTrigger:f}},render(){const{$slots:e,mergedClsPrefix:o}=this;return this.displayDirective==="show"||this.displayed||this.show?Ie(d("div",{role:"none"},d(_t,{disabled:!this.showMask||!this.trapFocus,active:this.show,autoFocus:this.autoFocus,onEsc:this.onEsc},{default:()=>d(Ze,{name:this.transitionName,appear:this.isMounted,onAfterEnter:this.onAfterEnter,onAfterLeave:this.handleAfterLeave},{default:()=>Ie(d("div",et(this.$attrs,{role:"dialog",ref:"bodyRef","aria-modal":"true",class:[`${o}-drawer`,this.rtlEnabled&&`${o}-drawer--rtl`,`${o}-drawer--${this.placement}-placement`,this.isDragging&&`${o}-drawer--unselectable`,this.nativeScrollbar&&`${o}-drawer--native-scrollbar`]}),[this.resizable?d("div",{class:[`${o}-drawer__resize-trigger`,(this.isDragging||this.isHoverOnResizeTrigger)&&`${o}-drawer__resize-trigger--hover`],onMouseenter:this.handleMouseenterResizeTrigger,onMouseleave:this.handleMouseleaveResizeTrigger,onMousedown:this.handleMousedownResizeTrigger}):null,this.nativeScrollbar?d("div",{class:[`${o}-drawer-content-wrapper`,this.contentClass],style:this.contentStyle,role:"none"},e):d(Be,Object.assign({},this.scrollbarProps,{contentStyle:this.contentStyle,contentClass:[`${o}-drawer-content-wrapper`,this.contentClass],theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar}),e)]),this.bodyDirectives)})})),[[De,this.displayDirective==="if"||this.displayed||this.show]]):null}}),{cubicBezierEaseIn:yo,cubicBezierEaseOut:ko}=fe;function zo({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-bottom"}={}){return[u(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${yo}`}),u(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${ko}`}),u(`&.${t}-transition-enter-to`,{transform:"translateY(0)"}),u(`&.${t}-transition-enter-from`,{transform:"translateY(100%)"}),u(`&.${t}-transition-leave-from`,{transform:"translateY(0)"}),u(`&.${t}-transition-leave-to`,{transform:"translateY(100%)"})]}const{cubicBezierEaseIn:So,cubicBezierEaseOut:_o}=fe;function Io({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-left"}={}){return[u(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${So}`}),u(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${_o}`}),u(`&.${t}-transition-enter-to`,{transform:"translateX(0)"}),u(`&.${t}-transition-enter-from`,{transform:"translateX(-100%)"}),u(`&.${t}-transition-leave-from`,{transform:"translateX(0)"}),u(`&.${t}-transition-leave-to`,{transform:"translateX(-100%)"})]}const{cubicBezierEaseIn:Ro,cubicBezierEaseOut:Mo}=fe;function $o({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-right"}={}){return[u(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${Ro}`}),u(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${Mo}`}),u(`&.${t}-transition-enter-to`,{transform:"translateX(0)"}),u(`&.${t}-transition-enter-from`,{transform:"translateX(100%)"}),u(`&.${t}-transition-leave-from`,{transform:"translateX(0)"}),u(`&.${t}-transition-leave-to`,{transform:"translateX(100%)"})]}const{cubicBezierEaseIn:To,cubicBezierEaseOut:Bo}=fe;function Oo({duration:e="0.3s",leaveDuration:o="0.2s",name:t="slide-in-from-top"}={}){return[u(`&.${t}-transition-leave-active`,{transition:`transform ${o} ${To}`}),u(`&.${t}-transition-enter-active`,{transition:`transform ${e} ${Bo}`}),u(`&.${t}-transition-enter-to`,{transform:"translateY(0)"}),u(`&.${t}-transition-enter-from`,{transform:"translateY(-100%)"}),u(`&.${t}-transition-leave-from`,{transform:"translateY(0)"}),u(`&.${t}-transition-leave-to`,{transform:"translateY(-100%)"})]}const Eo=u([m("drawer",`
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
 `,[$o(),Io(),Oo(),zo(),S("unselectable",`
 user-select: none; 
 -webkit-user-select: none;
 `),S("native-scrollbar",[m("drawer-content-wrapper",`
 overflow: auto;
 height: 100%;
 `)]),p("resize-trigger",`
 position: absolute;
 background-color: #0000;
 transition: background-color .3s var(--n-bezier);
 `,[S("hover",`
 background-color: var(--n-resize-trigger-color-hover);
 `)]),m("drawer-content-wrapper",`
 box-sizing: border-box;
 `),m("drawer-content",`
 height: 100%;
 display: flex;
 flex-direction: column;
 `,[S("native-scrollbar",[m("drawer-body-content-wrapper",`
 height: 100%;
 overflow: auto;
 `)]),m("drawer-body",`
 flex: 1 0 0;
 overflow: hidden;
 `),m("drawer-body-content-wrapper",`
 box-sizing: border-box;
 padding: var(--n-body-padding);
 `),m("drawer-header",`
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
 `,[p("main",`
 flex: 1;
 `),p("close",`
 margin-left: 6px;
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `)]),m("drawer-footer",`
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
 `,[p("resize-trigger",`
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
 `,[p("resize-trigger",`
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
 `,[p("resize-trigger",`
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
 `,[p("resize-trigger",`
 width: 100%;
 height: 3px;
 top: 0;
 left: 0;
 transform: translateY(-1.5px);
 cursor: ns-resize;
 `)])]),u("body",[u(">",[m("drawer-container",`
 position: fixed;
 `)])]),m("drawer-container",`
 position: relative;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 pointer-events: none;
 `,[u("> *",`
 pointer-events: all;
 `)]),m("drawer-mask",`
 background-color: rgba(0, 0, 0, .3);
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `,[S("invisible",`
 background-color: rgba(0, 0, 0, 0)
 `),Pt({enterDuration:"0.2s",leaveDuration:"0.2s",enterCubicBezier:"var(--n-bezier-in)",leaveCubicBezier:"var(--n-bezier-out)"})])]),Po=Object.assign(Object.assign({},J.props),{show:Boolean,width:[Number,String],height:[Number,String],placement:{type:String,default:"right"},maskClosable:{type:Boolean,default:!0},showMask:{type:[Boolean,String],default:!0},to:[String,Object],displayDirective:{type:String,default:"if"},nativeScrollbar:{type:Boolean,default:!0},zIndex:Number,onMaskClick:Function,scrollbarProps:Object,contentClass:String,contentStyle:[Object,String],trapFocus:{type:Boolean,default:!0},onEsc:Function,autoFocus:{type:Boolean,default:!0},closeOnEsc:{type:Boolean,default:!0},blockScroll:{type:Boolean,default:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,defaultWidth:{type:[Number,String],default:251},defaultHeight:{type:[Number,String],default:251},onUpdateWidth:[Function,Array],onUpdateHeight:[Function,Array],"onUpdate:width":[Function,Array],"onUpdate:height":[Function,Array],"onUpdate:show":[Function,Array],onUpdateShow:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,drawerStyle:[String,Object],drawerClass:String,target:null,onShow:Function,onHide:Function}),Ao=T({name:"Drawer",inheritAttrs:!1,props:Po,setup(e){const{mergedClsPrefixRef:o,namespaceRef:t,inlineThemeDisabled:n}=ne(e),i=Nt(),l=J("Drawer","-drawer",Eo,Ft,e,o),v=D(e.defaultWidth),f=D(e.defaultHeight),c=ue(re(e,"width"),v),g=ue(re(e,"height"),f),A=C(()=>{const{placement:h}=e;return h==="top"||h==="bottom"?"":de(c.value)}),_=C(()=>{const{placement:h}=e;return h==="left"||h==="right"?"":de(g.value)}),s=h=>{const{onUpdateWidth:b,"onUpdate:width":N}=e;b&&W(b,h),N&&W(N,h),v.value=h},O=h=>{const{onUpdateHeight:b,"onUpdate:width":N}=e;b&&W(b,h),N&&W(N,h),f.value=h},E=C(()=>[{width:A.value,height:_.value},e.drawerStyle||""]);function I(h){const{onMaskClick:b,maskClosable:N}=e;N&&F(!1),b&&b(h)}function $(h){I(h)}const w=Ht();function P(h){var b;(b=e.onEsc)===null||b===void 0||b.call(e),e.show&&e.closeOnEsc&&jt(h)&&(w.value||F(!1))}function F(h){const{onHide:b,onUpdateShow:N,"onUpdate:show":k}=e;N&&W(N,h),k&&W(k,h),b&&!h&&W(b,h)}Q(tt,{isMountedRef:i,mergedThemeRef:l,mergedClsPrefixRef:o,doUpdateShow:F,doUpdateHeight:O,doUpdateWidth:s});const V=C(()=>{const{common:{cubicBezierEaseInOut:h,cubicBezierEaseIn:b,cubicBezierEaseOut:N},self:{color:k,textColor:j,boxShadow:B,lineHeight:X,headerPadding:Y,footerPadding:Z,borderRadius:pe,bodyPadding:ge,titleFontSize:be,titleTextColor:xe,titleFontWeight:we,headerBorderBottom:Ce,footerBorderTop:x,closeIconColor:M,closeIconColorHover:r,closeIconColorPressed:z,closeColorHover:H,closeColorPressed:ye,closeIconSize:ke,closeSize:ze,closeBorderRadius:a,resizableTriggerColorHover:wt}}=l.value;return{"--n-line-height":X,"--n-color":k,"--n-border-radius":pe,"--n-text-color":j,"--n-box-shadow":B,"--n-bezier":h,"--n-bezier-out":N,"--n-bezier-in":b,"--n-header-padding":Y,"--n-body-padding":ge,"--n-footer-padding":Z,"--n-title-text-color":xe,"--n-title-font-size":be,"--n-title-font-weight":we,"--n-header-border-bottom":Ce,"--n-footer-border-top":x,"--n-close-icon-color":M,"--n-close-icon-color-hover":r,"--n-close-icon-color-pressed":z,"--n-close-size":ze,"--n-close-color-hover":H,"--n-close-color-pressed":ye,"--n-close-icon-size":ke,"--n-close-border-radius":a,"--n-resize-trigger-color-hover":wt}}),R=n?le("drawer",void 0,V,e):void 0;return{mergedClsPrefix:o,namespace:t,mergedBodyStyle:E,handleOutsideClick:$,handleMaskClick:I,handleEsc:P,mergedTheme:l,cssVars:n?void 0:V,themeClass:R?.themeClass,onRender:R?.onRender,isMounted:i}},render(){const{mergedClsPrefix:e}=this;return d(At,{to:this.to,show:this.show},{default:()=>{var o;return(o=this.onRender)===null||o===void 0||o.call(this),Ie(d("div",{class:[`${e}-drawer-container`,this.namespace,this.themeClass],style:this.cssVars,role:"none"},this.showMask?d(Ze,{name:"fade-in-transition",appear:this.isMounted},{default:()=>this.show?d("div",{"aria-hidden":!0,class:[`${e}-drawer-mask`,this.showMask==="transparent"&&`${e}-drawer-mask--invisible`],onClick:this.handleMaskClick}):null}):null,d(Co,Object.assign({},this.$attrs,{class:[this.drawerClass,this.$attrs.class],style:[this.mergedBodyStyle,this.$attrs.style],blockScroll:this.blockScroll,contentStyle:this.contentStyle,contentClass:this.contentClass,placement:this.placement,scrollbarProps:this.scrollbarProps,show:this.show,displayDirective:this.displayDirective,nativeScrollbar:this.nativeScrollbar,onAfterEnter:this.onAfterEnter,onAfterLeave:this.onAfterLeave,trapFocus:this.trapFocus,autoFocus:this.autoFocus,resizable:this.resizable,maxHeight:this.maxHeight,minHeight:this.minHeight,maxWidth:this.maxWidth,minWidth:this.minWidth,showMask:this.showMask,onEsc:this.handleEsc,onClickoutside:this.handleOutsideClick}),this.$slots)),[[Lt,{zIndex:this.zIndex,enabled:this.show}]])}})}});function No(e){const{baseColor:o,textColor2:t,bodyColor:n,cardColor:i,dividerColor:l,actionColor:v,scrollbarColor:f,scrollbarColorHover:c,invertedColor:g}=e;return{textColor:t,textColorInverted:"#FFF",color:n,colorEmbedded:v,headerColor:i,headerColorInverted:g,footerColor:v,footerColorInverted:g,headerBorderColor:l,headerBorderColorInverted:g,footerBorderColor:l,footerBorderColorInverted:g,siderBorderColor:l,siderBorderColorInverted:g,siderColor:i,siderColorInverted:g,siderToggleButtonBorder:`1px solid ${l}`,siderToggleButtonColor:o,siderToggleButtonIconColor:t,siderToggleButtonIconColorInverted:t,siderToggleBarColor:Ke(n,f),siderToggleBarColorHover:Ke(n,c),__invertScrollbar:"true"}}const Pe=Dt({name:"Layout",common:Ut,peers:{Scrollbar:Kt},self:No}),st=ae("n-layout-sider"),Ae={type:String,default:"static"},Ho=m("layout",`
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
`,[m("layout-scroll-container",`
 overflow-x: hidden;
 box-sizing: border-box;
 height: 100%;
 `),S("absolute-positioned",`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),Lo={embedded:Boolean,position:Ae,nativeScrollbar:{type:Boolean,default:!0},scrollbarProps:Object,onScroll:Function,contentClass:String,contentStyle:{type:[String,Object],default:""},hasSider:Boolean,siderPlacement:{type:String,default:"left"}},ct=ae("n-layout");function dt(e){return T({name:e?"LayoutContent":"Layout",props:Object.assign(Object.assign({},J.props),Lo),setup(o){const t=D(null),n=D(null),{mergedClsPrefixRef:i,inlineThemeDisabled:l}=ne(o),v=J("Layout","-layout",Ho,Pe,o,i);function f(I,$){if(o.nativeScrollbar){const{value:w}=t;w&&($===void 0?w.scrollTo(I):w.scrollTo(I,$))}else{const{value:w}=n;w&&w.scrollTo(I,$)}}Q(ct,o);let c=0,g=0;const A=I=>{var $;const w=I.target;c=w.scrollLeft,g=w.scrollTop,($=o.onScroll)===null||$===void 0||$.call(o,I)};ot(()=>{if(o.nativeScrollbar){const I=t.value;I&&(I.scrollTop=g,I.scrollLeft=c)}});const _={display:"flex",flexWrap:"nowrap",width:"100%",flexDirection:"row"},s={scrollTo:f},O=C(()=>{const{common:{cubicBezierEaseInOut:I},self:$}=v.value;return{"--n-bezier":I,"--n-color":o.embedded?$.colorEmbedded:$.color,"--n-text-color":$.textColor}}),E=l?le("layout",C(()=>o.embedded?"e":""),O,o):void 0;return Object.assign({mergedClsPrefix:i,scrollableElRef:t,scrollbarInstRef:n,hasSiderStyle:_,mergedTheme:v,handleNativeElScroll:A,cssVars:l?void 0:O,themeClass:E?.themeClass,onRender:E?.onRender},s)},render(){var o;const{mergedClsPrefix:t,hasSider:n}=this;(o=this.onRender)===null||o===void 0||o.call(this);const i=n?this.hasSiderStyle:void 0,l=[this.themeClass,e&&`${t}-layout-content`,`${t}-layout`,`${t}-layout--${this.position}-positioned`];return d("div",{class:l,style:this.cssVars},this.nativeScrollbar?d("div",{ref:"scrollableElRef",class:[`${t}-layout-scroll-container`,this.contentClass],style:[this.contentStyle,i],onScroll:this.handleNativeElScroll},this.$slots):d(Be,Object.assign({},this.scrollbarProps,{onScroll:this.onScroll,ref:"scrollbarInstRef",theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,contentClass:this.contentClass,contentStyle:[this.contentStyle,i]}),this.$slots))}})}const jo=dt(!1),Fo=dt(!0),Do=m("layout-header",`
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
 `)]),Ko={position:Ae,inverted:Boolean,bordered:{type:Boolean,default:!1}},Uo=T({name:"LayoutHeader",props:Object.assign(Object.assign({},J.props),Ko),setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:t}=ne(e),n=J("Layout","-layout-header",Do,Pe,e,o),i=C(()=>{const{common:{cubicBezierEaseInOut:v},self:f}=n.value,c={"--n-bezier":v};return e.inverted?(c["--n-color"]=f.headerColorInverted,c["--n-text-color"]=f.textColorInverted,c["--n-border-color"]=f.headerBorderColorInverted):(c["--n-color"]=f.headerColor,c["--n-text-color"]=f.textColor,c["--n-border-color"]=f.headerBorderColor),c}),l=t?le("layout-header",C(()=>e.inverted?"a":"b"),i,e):void 0;return{mergedClsPrefix:o,cssVars:t?void 0:i,themeClass:l?.themeClass,onRender:l?.onRender}},render(){var e;const{mergedClsPrefix:o}=this;return(e=this.onRender)===null||e===void 0||e.call(this),d("div",{class:[`${o}-layout-header`,this.themeClass,this.position&&`${o}-layout-header--${this.position}-positioned`,this.bordered&&`${o}-layout-header--bordered`],style:this.cssVars},this.$slots)}}),Vo=m("layout-sider",`
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
`,[S("bordered",[p("border",`
 content: "";
 position: absolute;
 top: 0;
 bottom: 0;
 width: 1px;
 background-color: var(--n-border-color);
 transition: background-color .3s var(--n-bezier);
 `)]),p("left-placement",[S("bordered",[p("border",`
 right: 0;
 `)])]),S("right-placement",`
 justify-content: flex-start;
 `,[S("bordered",[p("border",`
 left: 0;
 `)]),S("collapsed",[m("layout-toggle-button",[m("base-icon",`
 transform: rotate(180deg);
 `)]),m("layout-toggle-bar",[u("&:hover",[p("top",{transform:"rotate(-12deg) scale(1.15) translateY(-2px)"}),p("bottom",{transform:"rotate(12deg) scale(1.15) translateY(2px)"})])])]),m("layout-toggle-button",`
 left: 0;
 transform: translateX(-50%) translateY(-50%);
 `,[m("base-icon",`
 transform: rotate(0);
 `)]),m("layout-toggle-bar",`
 left: -28px;
 transform: rotate(180deg);
 `,[u("&:hover",[p("top",{transform:"rotate(12deg) scale(1.15) translateY(-2px)"}),p("bottom",{transform:"rotate(-12deg) scale(1.15) translateY(2px)"})])])]),S("collapsed",[m("layout-toggle-bar",[u("&:hover",[p("top",{transform:"rotate(-12deg) scale(1.15) translateY(-2px)"}),p("bottom",{transform:"rotate(12deg) scale(1.15) translateY(2px)"})])]),m("layout-toggle-button",[m("base-icon",`
 transform: rotate(0);
 `)])]),m("layout-toggle-button",`
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
 `,[m("base-icon",`
 transition: transform .3s var(--n-bezier);
 transform: rotate(180deg);
 `)]),m("layout-toggle-bar",`
 cursor: pointer;
 height: 72px;
 width: 32px;
 position: absolute;
 top: calc(50% - 36px);
 right: -28px;
 `,[p("top, bottom",`
 position: absolute;
 width: 4px;
 border-radius: 2px;
 height: 38px;
 left: 14px;
 transition: 
 background-color .3s var(--n-bezier),
 transform .3s var(--n-bezier);
 `),p("bottom",`
 position: absolute;
 top: 34px;
 `),u("&:hover",[p("top",{transform:"rotate(12deg) scale(1.15) translateY(-2px)"}),p("bottom",{transform:"rotate(-12deg) scale(1.15) translateY(2px)"})]),p("top, bottom",{backgroundColor:"var(--n-toggle-bar-color)"}),u("&:hover",[p("top, bottom",{backgroundColor:"var(--n-toggle-bar-color-hover)"})])]),p("border",`
 position: absolute;
 top: 0;
 right: 0;
 bottom: 0;
 width: 1px;
 transition: background-color .3s var(--n-bezier);
 `),m("layout-sider-scroll-container",`
 flex-grow: 1;
 flex-shrink: 0;
 box-sizing: border-box;
 height: 100%;
 opacity: 0;
 transition: opacity .3s var(--n-bezier);
 max-width: 100%;
 `),S("show-content",[m("layout-sider-scroll-container",{opacity:1})]),S("absolute-positioned",`
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 `)]),Wo=T({props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){const{clsPrefix:e}=this;return d("div",{onClick:this.onClick,class:`${e}-layout-toggle-bar`},d("div",{class:`${e}-layout-toggle-bar__top`}),d("div",{class:`${e}-layout-toggle-bar__bottom`}))}}),Yo=T({name:"LayoutToggleButton",props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){const{clsPrefix:e}=this;return d("div",{class:`${e}-layout-toggle-button`,onClick:this.onClick},d(rt,{clsPrefix:e},{default:()=>d(ho,null)}))}}),Xo={position:Ae,bordered:Boolean,collapsedWidth:{type:Number,default:48},width:{type:[Number,String],default:272},contentClass:String,contentStyle:{type:[String,Object],default:""},collapseMode:{type:String,default:"transform"},collapsed:{type:Boolean,default:void 0},defaultCollapsed:Boolean,showCollapsedContent:{type:Boolean,default:!0},showTrigger:{type:[Boolean,String],default:!1},nativeScrollbar:{type:Boolean,default:!0},inverted:Boolean,scrollbarProps:Object,triggerClass:String,triggerStyle:[String,Object],collapsedTriggerClass:String,collapsedTriggerStyle:[String,Object],"onUpdate:collapsed":[Function,Array],onUpdateCollapsed:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,onExpand:[Function,Array],onCollapse:[Function,Array],onScroll:Function},Go=T({name:"LayoutSider",props:Object.assign(Object.assign({},J.props),Xo),setup(e){const o=ee(ct),t=D(null),n=D(null),i=D(e.defaultCollapsed),l=ue(re(e,"collapsed"),i),v=C(()=>de(l.value?e.collapsedWidth:e.width)),f=C(()=>e.collapseMode!=="transform"?{}:{minWidth:de(e.width)}),c=C(()=>o?o.siderPlacement:"left");function g(R,h){if(e.nativeScrollbar){const{value:b}=t;b&&(h===void 0?b.scrollTo(R):b.scrollTo(R,h))}else{const{value:b}=n;b&&b.scrollTo(R,h)}}function A(){const{"onUpdate:collapsed":R,onUpdateCollapsed:h,onExpand:b,onCollapse:N}=e,{value:k}=l;h&&W(h,!k),R&&W(R,!k),i.value=!k,k?b&&W(b):N&&W(N)}let _=0,s=0;const O=R=>{var h;const b=R.target;_=b.scrollLeft,s=b.scrollTop,(h=e.onScroll)===null||h===void 0||h.call(e,R)};ot(()=>{if(e.nativeScrollbar){const R=t.value;R&&(R.scrollTop=s,R.scrollLeft=_)}}),Q(st,{collapsedRef:l,collapseModeRef:re(e,"collapseMode")});const{mergedClsPrefixRef:E,inlineThemeDisabled:I}=ne(e),$=J("Layout","-layout-sider",Vo,Pe,e,E);function w(R){var h,b;R.propertyName==="max-width"&&(l.value?(h=e.onAfterLeave)===null||h===void 0||h.call(e):(b=e.onAfterEnter)===null||b===void 0||b.call(e))}const P={scrollTo:g},F=C(()=>{const{common:{cubicBezierEaseInOut:R},self:h}=$.value,{siderToggleButtonColor:b,siderToggleButtonBorder:N,siderToggleBarColor:k,siderToggleBarColorHover:j}=h,B={"--n-bezier":R,"--n-toggle-button-color":b,"--n-toggle-button-border":N,"--n-toggle-bar-color":k,"--n-toggle-bar-color-hover":j};return e.inverted?(B["--n-color"]=h.siderColorInverted,B["--n-text-color"]=h.textColorInverted,B["--n-border-color"]=h.siderBorderColorInverted,B["--n-toggle-button-icon-color"]=h.siderToggleButtonIconColorInverted,B.__invertScrollbar=h.__invertScrollbar):(B["--n-color"]=h.siderColor,B["--n-text-color"]=h.textColor,B["--n-border-color"]=h.siderBorderColor,B["--n-toggle-button-icon-color"]=h.siderToggleButtonIconColor),B}),V=I?le("layout-sider",C(()=>e.inverted?"a":"b"),F,e):void 0;return Object.assign({scrollableElRef:t,scrollbarInstRef:n,mergedClsPrefix:E,mergedTheme:$,styleMaxWidth:v,mergedCollapsed:l,scrollContainerStyle:f,siderPlacement:c,handleNativeElScroll:O,handleTransitionend:w,handleTriggerClick:A,inlineThemeDisabled:I,cssVars:F,themeClass:V?.themeClass,onRender:V?.onRender},P)},render(){var e;const{mergedClsPrefix:o,mergedCollapsed:t,showTrigger:n}=this;return(e=this.onRender)===null||e===void 0||e.call(this),d("aside",{class:[`${o}-layout-sider`,this.themeClass,`${o}-layout-sider--${this.position}-positioned`,`${o}-layout-sider--${this.siderPlacement}-placement`,this.bordered&&`${o}-layout-sider--bordered`,t&&`${o}-layout-sider--collapsed`,(!t||this.showCollapsedContent)&&`${o}-layout-sider--show-content`],onTransitionend:this.handleTransitionend,style:[this.inlineThemeDisabled?void 0:this.cssVars,{maxWidth:this.styleMaxWidth,width:de(this.width)}]},this.nativeScrollbar?d("div",{class:[`${o}-layout-sider-scroll-container`,this.contentClass],onScroll:this.handleNativeElScroll,style:[this.scrollContainerStyle,{overflow:"auto"},this.contentStyle],ref:"scrollableElRef"},this.$slots):d(Be,Object.assign({},this.scrollbarProps,{onScroll:this.onScroll,ref:"scrollbarInstRef",style:this.scrollContainerStyle,contentStyle:this.contentStyle,contentClass:this.contentClass,theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,builtinThemeOverrides:this.inverted&&this.cssVars.__invertScrollbar==="true"?{colorHover:"rgba(255, 255, 255, .4)",color:"rgba(255, 255, 255, .3)"}:void 0}),this.$slots),n?n==="bar"?d(Wo,{clsPrefix:o,class:t?this.collapsedTriggerClass:this.triggerClass,style:t?this.collapsedTriggerStyle:this.triggerStyle,onClick:this.handleTriggerClick}):d(Yo,{clsPrefix:o,class:t?this.collapsedTriggerClass:this.triggerClass,style:t?this.collapsedTriggerStyle:this.triggerStyle,onClick:this.handleTriggerClick}):null,this.bordered?d("div",{class:`${o}-layout-sider__border`}):null)}}),he=ae("n-menu"),ut=ae("n-submenu"),Ne=ae("n-menu-item-group"),Xe=[u("&::before","background-color: var(--n-item-color-hover);"),p("arrow",`
 color: var(--n-arrow-color-hover);
 `),p("icon",`
 color: var(--n-item-icon-color-hover);
 `),m("menu-item-content-header",`
 color: var(--n-item-text-color-hover);
 `,[u("a",`
 color: var(--n-item-text-color-hover);
 `),p("extra",`
 color: var(--n-item-text-color-hover);
 `)])],Ge=[p("icon",`
 color: var(--n-item-icon-color-hover-horizontal);
 `),m("menu-item-content-header",`
 color: var(--n-item-text-color-hover-horizontal);
 `,[u("a",`
 color: var(--n-item-text-color-hover-horizontal);
 `),p("extra",`
 color: var(--n-item-text-color-hover-horizontal);
 `)])],qo=u([m("menu",`
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
 `,[m("submenu","margin: 0;"),m("menu-item","margin: 0;"),m("menu-item-content",`
 padding: 0 20px;
 border-bottom: 2px solid #0000;
 `,[u("&::before","display: none;"),S("selected","border-bottom: 2px solid var(--n-border-color-horizontal)")]),m("menu-item-content",[S("selected",[p("icon","color: var(--n-item-icon-color-active-horizontal);"),m("menu-item-content-header",`
 color: var(--n-item-text-color-active-horizontal);
 `,[u("a","color: var(--n-item-text-color-active-horizontal);"),p("extra","color: var(--n-item-text-color-active-horizontal);")])]),S("child-active",`
 border-bottom: 2px solid var(--n-border-color-horizontal);
 `,[m("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-horizontal);
 `,[u("a",`
 color: var(--n-item-text-color-child-active-horizontal);
 `),p("extra",`
 color: var(--n-item-text-color-child-active-horizontal);
 `)]),p("icon",`
 color: var(--n-item-icon-color-child-active-horizontal);
 `)]),se("disabled",[se("selected, child-active",[u("&:focus-within",Ge)]),S("selected",[oe(null,[p("icon","color: var(--n-item-icon-color-active-hover-horizontal);"),m("menu-item-content-header",`
 color: var(--n-item-text-color-active-hover-horizontal);
 `,[u("a","color: var(--n-item-text-color-active-hover-horizontal);"),p("extra","color: var(--n-item-text-color-active-hover-horizontal);")])])]),S("child-active",[oe(null,[p("icon","color: var(--n-item-icon-color-child-active-hover-horizontal);"),m("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-hover-horizontal);
 `,[u("a","color: var(--n-item-text-color-child-active-hover-horizontal);"),p("extra","color: var(--n-item-text-color-child-active-hover-horizontal);")])])]),oe("border-bottom: 2px solid var(--n-border-color-horizontal);",Ge)]),m("menu-item-content-header",[u("a","color: var(--n-item-text-color-horizontal);")])])]),se("responsive",[m("menu-item-content-header",`
 overflow: hidden;
 text-overflow: ellipsis;
 `)]),S("collapsed",[m("menu-item-content",[S("selected",[u("&::before",`
 background-color: var(--n-item-color-active-collapsed) !important;
 `)]),m("menu-item-content-header","opacity: 0;"),p("arrow","opacity: 0;"),p("icon","color: var(--n-item-icon-color-collapsed);")])]),m("menu-item",`
 height: var(--n-item-height);
 margin-top: 6px;
 position: relative;
 `),m("menu-item-content",`
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
 `),S("disabled",`
 opacity: .45;
 cursor: not-allowed;
 `),S("collapsed",[p("arrow","transform: rotate(0);")]),S("selected",[u("&::before","background-color: var(--n-item-color-active);"),p("arrow","color: var(--n-arrow-color-active);"),p("icon","color: var(--n-item-icon-color-active);"),m("menu-item-content-header",`
 color: var(--n-item-text-color-active);
 `,[u("a","color: var(--n-item-text-color-active);"),p("extra","color: var(--n-item-text-color-active);")])]),S("child-active",[m("menu-item-content-header",`
 color: var(--n-item-text-color-child-active);
 `,[u("a",`
 color: var(--n-item-text-color-child-active);
 `),p("extra",`
 color: var(--n-item-text-color-child-active);
 `)]),p("arrow",`
 color: var(--n-arrow-color-child-active);
 `),p("icon",`
 color: var(--n-item-icon-color-child-active);
 `)]),se("disabled",[se("selected, child-active",[u("&:focus-within",Xe)]),S("selected",[oe(null,[p("arrow","color: var(--n-arrow-color-active-hover);"),p("icon","color: var(--n-item-icon-color-active-hover);"),m("menu-item-content-header",`
 color: var(--n-item-text-color-active-hover);
 `,[u("a","color: var(--n-item-text-color-active-hover);"),p("extra","color: var(--n-item-text-color-active-hover);")])])]),S("child-active",[oe(null,[p("arrow","color: var(--n-arrow-color-child-active-hover);"),p("icon","color: var(--n-item-icon-color-child-active-hover);"),m("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-hover);
 `,[u("a","color: var(--n-item-text-color-child-active-hover);"),p("extra","color: var(--n-item-text-color-child-active-hover);")])])]),S("selected",[oe(null,[u("&::before","background-color: var(--n-item-color-active-hover);")])]),oe(null,Xe)]),p("icon",`
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
 `),p("arrow",`
 grid-area: arrow;
 font-size: 16px;
 color: var(--n-arrow-color);
 transform: rotate(180deg);
 opacity: 1;
 transition:
 color .3s var(--n-bezier),
 transform 0.2s var(--n-bezier),
 opacity 0.2s var(--n-bezier);
 `),m("menu-item-content-header",`
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
 `)]),p("extra",`
 font-size: .93em;
 color: var(--n-group-text-color);
 transition: color .3s var(--n-bezier);
 `)])]),m("submenu",`
 cursor: pointer;
 position: relative;
 margin-top: 6px;
 `,[m("menu-item-content",`
 height: var(--n-item-height);
 `),m("submenu-children",`
 overflow: hidden;
 padding: 0;
 `,[Vt({duration:".2s"})])]),m("menu-item-group",[m("menu-item-group-title",`
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
 `)])]),m("menu-tooltip",[u("a",`
 color: inherit;
 text-decoration: none;
 `)]),m("menu-divider",`
 transition: background-color .3s var(--n-bezier);
 background-color: var(--n-divider-color);
 height: 1px;
 margin: 6px 18px;
 `)]);function oe(e,o){return[S("hover",e,o),u("&:hover",e,o)]}const ht=T({name:"MenuOptionContent",props:{collapsed:Boolean,disabled:Boolean,title:[String,Function],icon:Function,extra:[String,Function],showArrow:Boolean,childActive:Boolean,hover:Boolean,paddingLeft:Number,selected:Boolean,maxIconSize:{type:Number,required:!0},activeIconSize:{type:Number,required:!0},iconMarginRight:{type:Number,required:!0},clsPrefix:{type:String,required:!0},onClick:Function,tmNode:{type:Object,required:!0},isEllipsisPlaceholder:Boolean},setup(e){const{props:o}=ee(he);return{menuProps:o,style:C(()=>{const{paddingLeft:t}=e;return{paddingLeft:t&&`${t}px`}}),iconStyle:C(()=>{const{maxIconSize:t,activeIconSize:n,iconMarginRight:i}=e;return{width:`${t}px`,height:`${t}px`,fontSize:`${n}px`,marginRight:`${i}px`}})}},render(){const{clsPrefix:e,tmNode:o,menuProps:{renderIcon:t,renderLabel:n,renderExtra:i,expandIcon:l}}=this,v=t?t(o.rawNode):ie(this.icon);return d("div",{onClick:f=>{var c;(c=this.onClick)===null||c===void 0||c.call(this,f)},role:"none",class:[`${e}-menu-item-content`,{[`${e}-menu-item-content--selected`]:this.selected,[`${e}-menu-item-content--collapsed`]:this.collapsed,[`${e}-menu-item-content--child-active`]:this.childActive,[`${e}-menu-item-content--disabled`]:this.disabled,[`${e}-menu-item-content--hover`]:this.hover}],style:this.style},v&&d("div",{class:`${e}-menu-item-content__icon`,style:this.iconStyle,role:"none"},[v]),d("div",{class:`${e}-menu-item-content-header`,role:"none"},this.isEllipsisPlaceholder?this.title:n?n(o.rawNode):ie(this.title),this.extra||i?d("span",{class:`${e}-menu-item-content-header__extra`}," ",i?i(o.rawNode):ie(this.extra)):null),this.showArrow?d(rt,{ariaHidden:!0,class:`${e}-menu-item-content__arrow`,clsPrefix:e},{default:()=>l?l(o.rawNode):d(vo,null)}):null)}}),ve=8;function He(e){const o=ee(he),{props:t,mergedCollapsedRef:n}=o,i=ee(ut,null),l=ee(Ne,null),v=C(()=>t.mode==="horizontal"),f=C(()=>v.value?t.dropdownPlacement:"tmNodes"in e?"right-start":"right"),c=C(()=>{var s;return Math.max((s=t.collapsedIconSize)!==null&&s!==void 0?s:t.iconSize,t.iconSize)}),g=C(()=>{var s;return!v.value&&e.root&&n.value&&(s=t.collapsedIconSize)!==null&&s!==void 0?s:t.iconSize}),A=C(()=>{if(v.value)return;const{collapsedWidth:s,indent:O,rootIndent:E}=t,{root:I,isGroup:$}=e,w=E===void 0?O:E;return I?n.value?s/2-c.value/2:w:l&&typeof l.paddingLeftRef.value=="number"?O/2+l.paddingLeftRef.value:i&&typeof i.paddingLeftRef.value=="number"?($?O/2:O)+i.paddingLeftRef.value:0}),_=C(()=>{const{collapsedWidth:s,indent:O,rootIndent:E}=t,{value:I}=c,{root:$}=e;return v.value||!$||!n.value?ve:(E===void 0?O:E)+I+ve-(s+I)/2});return{dropdownPlacement:f,activeIconSize:g,maxIconSize:c,paddingLeft:A,iconMarginRight:_,NMenu:o,NSubmenu:i,NMenuOptionGroup:l}}const Le={internalKey:{type:[String,Number],required:!0},root:Boolean,isGroup:Boolean,level:{type:Number,required:!0},title:[String,Function],extra:[String,Function]},Jo=T({name:"MenuDivider",setup(){const e=ee(he),{mergedClsPrefixRef:o,isHorizontalRef:t}=e;return()=>t.value?null:d("div",{class:`${o.value}-menu-divider`})}}),mt=Object.assign(Object.assign({},Le),{tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function}),Qo=Oe(mt),Zo=T({name:"MenuOption",props:mt,setup(e){const o=He(e),{NSubmenu:t,NMenu:n,NMenuOptionGroup:i}=o,{props:l,mergedClsPrefixRef:v,mergedCollapsedRef:f}=n,c=t?t.mergedDisabledRef:i?i.mergedDisabledRef:{value:!1},g=C(()=>c.value||e.disabled);function A(s){const{onClick:O}=e;O&&O(s)}function _(s){g.value||(n.doSelect(e.internalKey,e.tmNode.rawNode),A(s))}return{mergedClsPrefix:v,dropdownPlacement:o.dropdownPlacement,paddingLeft:o.paddingLeft,iconMarginRight:o.iconMarginRight,maxIconSize:o.maxIconSize,activeIconSize:o.activeIconSize,mergedTheme:n.mergedThemeRef,menuProps:l,dropdownEnabled:Me(()=>e.root&&f.value&&l.mode!=="horizontal"&&!g.value),selected:Me(()=>n.mergedValueRef.value===e.internalKey),mergedDisabled:g,handleClick:_}},render(){const{mergedClsPrefix:e,mergedTheme:o,tmNode:t,menuProps:{renderLabel:n,nodeProps:i}}=this,l=i?.(t.rawNode);return d("div",Object.assign({},l,{role:"menuitem",class:[`${e}-menu-item`,l?.class]}),d(so,{theme:o.peers.Tooltip,themeOverrides:o.peerOverrides.Tooltip,trigger:"hover",placement:this.dropdownPlacement,disabled:!this.dropdownEnabled||this.title===void 0,internalExtraClass:["menu-tooltip"]},{default:()=>n?n(t.rawNode):ie(this.title),trigger:()=>d(ht,{tmNode:t,clsPrefix:e,paddingLeft:this.paddingLeft,iconMarginRight:this.iconMarginRight,maxIconSize:this.maxIconSize,activeIconSize:this.activeIconSize,selected:this.selected,title:this.title,extra:this.extra,disabled:this.mergedDisabled,icon:this.icon,onClick:this.handleClick})}))}}),vt=Object.assign(Object.assign({},Le),{tmNode:{type:Object,required:!0},tmNodes:{type:Array,required:!0}}),er=Oe(vt),tr=T({name:"MenuOptionGroup",props:vt,setup(e){const o=He(e),{NSubmenu:t}=o,n=C(()=>t?.mergedDisabledRef.value?!0:e.tmNode.disabled);Q(Ne,{paddingLeftRef:o.paddingLeft,mergedDisabledRef:n});const{mergedClsPrefixRef:i,props:l}=ee(he);return function(){const{value:v}=i,f=o.paddingLeft.value,{nodeProps:c}=l,g=c?.(e.tmNode.rawNode);return d("div",{class:`${v}-menu-item-group`,role:"group"},d("div",Object.assign({},g,{class:[`${v}-menu-item-group-title`,g?.class],style:[g?.style||"",f!==void 0?`padding-left: ${f}px;`:""]}),ie(e.title),e.extra?d(nt,null," ",ie(e.extra)):null),d("div",null,e.tmNodes.map(A=>je(A,l))))}}});function $e(e){return e.type==="divider"||e.type==="render"}function or(e){return e.type==="divider"}function je(e,o){const{rawNode:t}=e,{show:n}=t;if(n===!1)return null;if($e(t))return or(t)?d(Jo,Object.assign({key:e.key},t.props)):null;const{labelField:i}=o,{key:l,level:v,isGroup:f}=e,c=Object.assign(Object.assign({},t),{title:t.title||t[i],extra:t.titleExtra||t.extra,key:l,internalKey:l,level:v,root:v===0,isGroup:f});return e.children?e.isGroup?d(tr,Se(c,er,{tmNode:e,tmNodes:e.children,key:l})):d(Te,Se(c,rr,{key:l,rawNodes:t[o.childrenField],tmNodes:e.children,tmNode:e})):d(Zo,Se(c,Qo,{key:l,tmNode:e}))}const ft=Object.assign(Object.assign({},Le),{rawNodes:{type:Array,default:()=>[]},tmNodes:{type:Array,default:()=>[]},tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function,domId:String,virtualChildActive:{type:Boolean,default:void 0},isEllipsisPlaceholder:Boolean}),rr=Oe(ft),Te=T({name:"Submenu",props:ft,setup(e){const o=He(e),{NMenu:t,NSubmenu:n}=o,{props:i,mergedCollapsedRef:l,mergedThemeRef:v}=t,f=C(()=>{const{disabled:s}=e;return n?.mergedDisabledRef.value||i.disabled?!0:s}),c=D(!1);Q(ut,{paddingLeftRef:o.paddingLeft,mergedDisabledRef:f}),Q(Ne,null);function g(){const{onClick:s}=e;s&&s()}function A(){f.value||(l.value||t.toggleExpand(e.internalKey),g())}function _(s){c.value=s}return{menuProps:i,mergedTheme:v,doSelect:t.doSelect,inverted:t.invertedRef,isHorizontal:t.isHorizontalRef,mergedClsPrefix:t.mergedClsPrefixRef,maxIconSize:o.maxIconSize,activeIconSize:o.activeIconSize,iconMarginRight:o.iconMarginRight,dropdownPlacement:o.dropdownPlacement,dropdownShow:c,paddingLeft:o.paddingLeft,mergedDisabled:f,mergedValue:t.mergedValueRef,childActive:Me(()=>{var s;return(s=e.virtualChildActive)!==null&&s!==void 0?s:t.activePathRef.value.includes(e.internalKey)}),collapsed:C(()=>i.mode==="horizontal"?!1:l.value?!0:!t.mergedExpandedKeysRef.value.includes(e.internalKey)),dropdownEnabled:C(()=>!f.value&&(i.mode==="horizontal"||l.value)),handlePopoverShowChange:_,handleClick:A}},render(){var e;const{mergedClsPrefix:o,menuProps:{renderIcon:t,renderLabel:n}}=this,i=()=>{const{isHorizontal:v,paddingLeft:f,collapsed:c,mergedDisabled:g,maxIconSize:A,activeIconSize:_,title:s,childActive:O,icon:E,handleClick:I,menuProps:{nodeProps:$},dropdownShow:w,iconMarginRight:P,tmNode:F,mergedClsPrefix:V,isEllipsisPlaceholder:R,extra:h}=this,b=$?.(F.rawNode);return d("div",Object.assign({},b,{class:[`${V}-menu-item`,b?.class],role:"menuitem"}),d(ht,{tmNode:F,paddingLeft:f,collapsed:c,disabled:g,iconMarginRight:P,maxIconSize:A,activeIconSize:_,title:s,extra:h,showArrow:!v,childActive:O,clsPrefix:V,icon:E,hover:w,onClick:I,isEllipsisPlaceholder:R}))},l=()=>d(Wt,null,{default:()=>{const{tmNodes:v,collapsed:f}=this;return f?null:d("div",{class:`${o}-submenu-children`,role:"menu"},v.map(c=>je(c,this.menuProps)))}});return this.root?d(lt,Object.assign({size:"large",trigger:"hover"},(e=this.menuProps)===null||e===void 0?void 0:e.dropdownProps,{themeOverrides:this.mergedTheme.peerOverrides.Dropdown,theme:this.mergedTheme.peers.Dropdown,builtinThemeOverrides:{fontSizeLarge:"14px",optionIconSizeLarge:"18px"},value:this.mergedValue,disabled:!this.dropdownEnabled,placement:this.dropdownPlacement,keyField:this.menuProps.keyField,labelField:this.menuProps.labelField,childrenField:this.menuProps.childrenField,onUpdateShow:this.handlePopoverShowChange,options:this.rawNodes,onSelect:this.doSelect,inverted:this.inverted,renderIcon:t,renderLabel:n}),{default:()=>d("div",{class:`${o}-submenu`,role:"menu","aria-expanded":!this.collapsed,id:this.domId},i(),this.isHorizontal?null:l())}):d("div",{class:`${o}-submenu`,role:"menu","aria-expanded":!this.collapsed,id:this.domId},i(),l())}}),nr=Object.assign(Object.assign({},J.props),{options:{type:Array,default:()=>[]},collapsed:{type:Boolean,default:void 0},collapsedWidth:{type:Number,default:48},iconSize:{type:Number,default:20},collapsedIconSize:{type:Number,default:24},rootIndent:Number,indent:{type:Number,default:32},labelField:{type:String,default:"label"},keyField:{type:String,default:"key"},childrenField:{type:String,default:"children"},disabledField:{type:String,default:"disabled"},defaultExpandAll:Boolean,defaultExpandedKeys:Array,expandedKeys:Array,value:[String,Number],defaultValue:{type:[String,Number],default:null},mode:{type:String,default:"vertical"},watchProps:{type:Array,default:void 0},disabled:Boolean,show:{type:Boolean,default:!0},inverted:Boolean,"onUpdate:expandedKeys":[Function,Array],onUpdateExpandedKeys:[Function,Array],onUpdateValue:[Function,Array],"onUpdate:value":[Function,Array],expandIcon:Function,renderIcon:Function,renderLabel:Function,renderExtra:Function,dropdownProps:Object,accordion:Boolean,nodeProps:Function,dropdownPlacement:{type:String,default:"bottom"},responsive:Boolean,items:Array,onOpenNamesChange:[Function,Array],onSelect:[Function,Array],onExpandedNamesChange:[Function,Array],expandedNames:Array,defaultExpandedNames:Array}),ir=T({name:"Menu",inheritAttrs:!1,props:nr,setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:t}=ne(e),n=J("Menu","-menu",qo,Gt,e,o),i=ee(st,null),l=C(()=>{var x;const{collapsed:M}=e;if(M!==void 0)return M;if(i){const{collapseModeRef:r,collapsedRef:z}=i;if(r.value==="width")return(x=z.value)!==null&&x!==void 0?x:!1}return!1}),v=C(()=>{const{keyField:x,childrenField:M,disabledField:r}=e;return _e(e.items||e.options,{getIgnored(z){return $e(z)},getChildren(z){return z[M]},getDisabled(z){return z[r]},getKey(z){var H;return(H=z[x])!==null&&H!==void 0?H:z.name}})}),f=C(()=>new Set(v.value.treeNodes.map(x=>x.key))),{watchProps:c}=e,g=D(null);c?.includes("defaultValue")?Re(()=>{g.value=e.defaultValue}):g.value=e.defaultValue;const A=re(e,"value"),_=ue(A,g),s=D([]),O=()=>{s.value=e.defaultExpandAll?v.value.getNonLeafKeys():e.defaultExpandedNames||e.defaultExpandedKeys||v.value.getPath(_.value,{includeSelf:!1}).keyPath};c?.includes("defaultExpandedKeys")?Re(O):O();const E=uo(e,["expandedNames","expandedKeys"]),I=ue(E,s),$=C(()=>v.value.treeNodes),w=C(()=>v.value.getPath(_.value).keyPath);Q(he,{props:e,mergedCollapsedRef:l,mergedThemeRef:n,mergedValueRef:_,mergedExpandedKeysRef:I,activePathRef:w,mergedClsPrefixRef:o,isHorizontalRef:C(()=>e.mode==="horizontal"),invertedRef:re(e,"inverted"),doSelect:P,toggleExpand:V});function P(x,M){const{"onUpdate:value":r,onUpdateValue:z,onSelect:H}=e;z&&W(z,x,M),r&&W(r,x,M),H&&W(H,x,M),g.value=x}function F(x){const{"onUpdate:expandedKeys":M,onUpdateExpandedKeys:r,onExpandedNamesChange:z,onOpenNamesChange:H}=e;M&&W(M,x),r&&W(r,x),z&&W(z,x),H&&W(H,x),s.value=x}function V(x){const M=Array.from(I.value),r=M.findIndex(z=>z===x);if(~r)M.splice(r,1);else{if(e.accordion&&f.value.has(x)){const z=M.findIndex(H=>f.value.has(H));z>-1&&M.splice(z,1)}M.push(x)}F(M)}const R=x=>{const M=v.value.getPath(x??_.value,{includeSelf:!1}).keyPath;if(!M.length)return;const r=Array.from(I.value),z=new Set([...r,...M]);e.accordion&&f.value.forEach(H=>{z.has(H)&&!M.includes(H)&&z.delete(H)}),F(Array.from(z))},h=C(()=>{const{inverted:x}=e,{common:{cubicBezierEaseInOut:M},self:r}=n.value,{borderRadius:z,borderColorHorizontal:H,fontSize:ye,itemHeight:ke,dividerColor:ze}=r,a={"--n-divider-color":ze,"--n-bezier":M,"--n-font-size":ye,"--n-border-color-horizontal":H,"--n-border-radius":z,"--n-item-height":ke};return x?(a["--n-group-text-color"]=r.groupTextColorInverted,a["--n-color"]=r.colorInverted,a["--n-item-text-color"]=r.itemTextColorInverted,a["--n-item-text-color-hover"]=r.itemTextColorHoverInverted,a["--n-item-text-color-active"]=r.itemTextColorActiveInverted,a["--n-item-text-color-child-active"]=r.itemTextColorChildActiveInverted,a["--n-item-text-color-child-active-hover"]=r.itemTextColorChildActiveInverted,a["--n-item-text-color-active-hover"]=r.itemTextColorActiveHoverInverted,a["--n-item-icon-color"]=r.itemIconColorInverted,a["--n-item-icon-color-hover"]=r.itemIconColorHoverInverted,a["--n-item-icon-color-active"]=r.itemIconColorActiveInverted,a["--n-item-icon-color-active-hover"]=r.itemIconColorActiveHoverInverted,a["--n-item-icon-color-child-active"]=r.itemIconColorChildActiveInverted,a["--n-item-icon-color-child-active-hover"]=r.itemIconColorChildActiveHoverInverted,a["--n-item-icon-color-collapsed"]=r.itemIconColorCollapsedInverted,a["--n-item-text-color-horizontal"]=r.itemTextColorHorizontalInverted,a["--n-item-text-color-hover-horizontal"]=r.itemTextColorHoverHorizontalInverted,a["--n-item-text-color-active-horizontal"]=r.itemTextColorActiveHorizontalInverted,a["--n-item-text-color-child-active-horizontal"]=r.itemTextColorChildActiveHorizontalInverted,a["--n-item-text-color-child-active-hover-horizontal"]=r.itemTextColorChildActiveHoverHorizontalInverted,a["--n-item-text-color-active-hover-horizontal"]=r.itemTextColorActiveHoverHorizontalInverted,a["--n-item-icon-color-horizontal"]=r.itemIconColorHorizontalInverted,a["--n-item-icon-color-hover-horizontal"]=r.itemIconColorHoverHorizontalInverted,a["--n-item-icon-color-active-horizontal"]=r.itemIconColorActiveHorizontalInverted,a["--n-item-icon-color-active-hover-horizontal"]=r.itemIconColorActiveHoverHorizontalInverted,a["--n-item-icon-color-child-active-horizontal"]=r.itemIconColorChildActiveHorizontalInverted,a["--n-item-icon-color-child-active-hover-horizontal"]=r.itemIconColorChildActiveHoverHorizontalInverted,a["--n-arrow-color"]=r.arrowColorInverted,a["--n-arrow-color-hover"]=r.arrowColorHoverInverted,a["--n-arrow-color-active"]=r.arrowColorActiveInverted,a["--n-arrow-color-active-hover"]=r.arrowColorActiveHoverInverted,a["--n-arrow-color-child-active"]=r.arrowColorChildActiveInverted,a["--n-arrow-color-child-active-hover"]=r.arrowColorChildActiveHoverInverted,a["--n-item-color-hover"]=r.itemColorHoverInverted,a["--n-item-color-active"]=r.itemColorActiveInverted,a["--n-item-color-active-hover"]=r.itemColorActiveHoverInverted,a["--n-item-color-active-collapsed"]=r.itemColorActiveCollapsedInverted):(a["--n-group-text-color"]=r.groupTextColor,a["--n-color"]=r.color,a["--n-item-text-color"]=r.itemTextColor,a["--n-item-text-color-hover"]=r.itemTextColorHover,a["--n-item-text-color-active"]=r.itemTextColorActive,a["--n-item-text-color-child-active"]=r.itemTextColorChildActive,a["--n-item-text-color-child-active-hover"]=r.itemTextColorChildActiveHover,a["--n-item-text-color-active-hover"]=r.itemTextColorActiveHover,a["--n-item-icon-color"]=r.itemIconColor,a["--n-item-icon-color-hover"]=r.itemIconColorHover,a["--n-item-icon-color-active"]=r.itemIconColorActive,a["--n-item-icon-color-active-hover"]=r.itemIconColorActiveHover,a["--n-item-icon-color-child-active"]=r.itemIconColorChildActive,a["--n-item-icon-color-child-active-hover"]=r.itemIconColorChildActiveHover,a["--n-item-icon-color-collapsed"]=r.itemIconColorCollapsed,a["--n-item-text-color-horizontal"]=r.itemTextColorHorizontal,a["--n-item-text-color-hover-horizontal"]=r.itemTextColorHoverHorizontal,a["--n-item-text-color-active-horizontal"]=r.itemTextColorActiveHorizontal,a["--n-item-text-color-child-active-horizontal"]=r.itemTextColorChildActiveHorizontal,a["--n-item-text-color-child-active-hover-horizontal"]=r.itemTextColorChildActiveHoverHorizontal,a["--n-item-text-color-active-hover-horizontal"]=r.itemTextColorActiveHoverHorizontal,a["--n-item-icon-color-horizontal"]=r.itemIconColorHorizontal,a["--n-item-icon-color-hover-horizontal"]=r.itemIconColorHoverHorizontal,a["--n-item-icon-color-active-horizontal"]=r.itemIconColorActiveHorizontal,a["--n-item-icon-color-active-hover-horizontal"]=r.itemIconColorActiveHoverHorizontal,a["--n-item-icon-color-child-active-horizontal"]=r.itemIconColorChildActiveHorizontal,a["--n-item-icon-color-child-active-hover-horizontal"]=r.itemIconColorChildActiveHoverHorizontal,a["--n-arrow-color"]=r.arrowColor,a["--n-arrow-color-hover"]=r.arrowColorHover,a["--n-arrow-color-active"]=r.arrowColorActive,a["--n-arrow-color-active-hover"]=r.arrowColorActiveHover,a["--n-arrow-color-child-active"]=r.arrowColorChildActive,a["--n-arrow-color-child-active-hover"]=r.arrowColorChildActiveHover,a["--n-item-color-hover"]=r.itemColorHover,a["--n-item-color-active"]=r.itemColorActive,a["--n-item-color-active-hover"]=r.itemColorActiveHover,a["--n-item-color-active-collapsed"]=r.itemColorActiveCollapsed),a}),b=t?le("menu",C(()=>e.inverted?"a":"b"),h,e):void 0,N=Xt(),k=D(null),j=D(null);let B=!0;const X=()=>{var x;B?B=!1:(x=k.value)===null||x===void 0||x.sync({showAllItemsBeforeCalculate:!0})};function Y(){return document.getElementById(N)}const Z=D(-1);function pe(x){Z.value=e.options.length-x}function ge(x){x||(Z.value=-1)}const be=C(()=>{const x=Z.value;return{children:x===-1?[]:e.options.slice(x)}}),xe=C(()=>{const{childrenField:x,disabledField:M,keyField:r}=e;return _e([be.value],{getIgnored(z){return $e(z)},getChildren(z){return z[x]},getDisabled(z){return z[M]},getKey(z){var H;return(H=z[r])!==null&&H!==void 0?H:z.name}})}),we=C(()=>_e([{}]).treeNodes[0]);function Ce(){var x;if(Z.value===-1)return d(Te,{root:!0,level:0,key:"__ellpisisGroupPlaceholder__",internalKey:"__ellpisisGroupPlaceholder__",title:"···",tmNode:we.value,domId:N,isEllipsisPlaceholder:!0});const M=xe.value.treeNodes[0],r=w.value,z=!!(!((x=M.children)===null||x===void 0)&&x.some(H=>r.includes(H.key)));return d(Te,{level:0,root:!0,key:"__ellpisisGroup__",internalKey:"__ellpisisGroup__",title:"···",virtualChildActive:z,tmNode:M,domId:N,rawNodes:M.rawNode.children||[],tmNodes:M.children||[],isEllipsisPlaceholder:!0})}return{mergedClsPrefix:o,controlledExpandedKeys:E,uncontrolledExpanededKeys:s,mergedExpandedKeys:I,uncontrolledValue:g,mergedValue:_,activePath:w,tmNodes:$,mergedTheme:n,mergedCollapsed:l,cssVars:t?void 0:h,themeClass:b?.themeClass,overflowRef:k,counterRef:j,updateCounter:()=>{},onResize:X,onUpdateOverflow:ge,onUpdateCount:pe,renderCounter:Ce,getCounter:Y,onRender:b?.onRender,showOption:R,deriveResponsiveState:X}},render(){const{mergedClsPrefix:e,mode:o,themeClass:t,onRender:n}=this;n?.();const i=()=>this.tmNodes.map(c=>je(c,this.$props)),v=o==="horizontal"&&this.responsive,f=()=>d("div",et(this.$attrs,{role:o==="horizontal"?"menubar":"menu",class:[`${e}-menu`,t,`${e}-menu--${o}`,v&&`${e}-menu--responsive`,this.mergedCollapsed&&`${e}-menu--collapsed`],style:this.cssVars}),v?d(co,{ref:"overflowRef",onUpdateOverflow:this.onUpdateOverflow,getCounter:this.getCounter,onUpdateCount:this.onUpdateCount,updateCounter:this.updateCounter,style:{width:"100%",display:"flex",overflow:"hidden"}},{default:i,counter:this.renderCounter}):i());return v?d(Yt,{onResize:this.onResize},{default:f}):f()}}),lr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},ar=T({name:"BusinessOutline",render:function(o,t){return L(),U("svg",lr,t[0]||(t[0]=[Ee('<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M176 416v64"></path><path d="M80 32h192a32 32 0 0 1 32 32v412a4 4 0 0 1-4 4H48h0V64a32 32 0 0 1 32-32z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path><path d="M320 192h112a32 32 0 0 1 32 32v256h0h-160h0V208a16 16 0 0 1 16-16z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path><path d="M98.08 431.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 351.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 271.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 191.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 111.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 351.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 271.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 191.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 111.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M258.08 431.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M258.08 351.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M258.08 271.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><ellipse cx="256" cy="176" rx="15.95" ry="16.03" transform="rotate(-45 255.99 175.996)" fill="currentColor"></ellipse><path d="M258.08 111.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M400 400a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M400 320a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M400 240a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M336 400a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M336 320a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M336 240a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path>',23)]))}}),sr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},cr=T({name:"CartOutline",render:function(o,t){return L(),U("svg",sr,t[0]||(t[0]=[y("circle",{cx:"176",cy:"416",r:"16",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("circle",{cx:"400",cy:"416",r:"16",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M48 80h64l48 272h256"},null,-1),y("path",{d:"M160 288h249.44a8 8 0 0 0 7.85-6.43l28.8-144a8 8 0 0 0-7.85-9.57H128",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),dr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},pt=T({name:"CheckmarkOutline",render:function(o,t){return L(),U("svg",dr,t[0]||(t[0]=[y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M416 128L192 384l-96-96"},null,-1)]))}}),ur={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},hr=T({name:"ContrastOutline",render:function(o,t){return L(),U("svg",ur,t[0]||(t[0]=[y("circle",{cx:"256",cy:"256",r:"208",fill:"none",stroke:"currentColor","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M256 464c-114.88 0-208-93.12-208-208S141.12 48 256 48z",fill:"currentColor"},null,-1)]))}}),mr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},qe=T({name:"CubeOutline",render:function(o,t){return L(),U("svg",mr,t[0]||(t[0]=[y("path",{d:"M448 341.37V170.61A32 32 0 0 0 432.11 143l-152-88.46a47.94 47.94 0 0 0-48.24 0L79.89 143A32 32 0 0 0 64 170.61v170.76A32 32 0 0 0 79.89 369l152 88.46a48 48 0 0 0 48.24 0l152-88.46A32 32 0 0 0 448 341.37z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M69 153.99l187 110l187-110"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M256 463.99v-200"},null,-1)]))}}),vr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},fr=T({name:"DocumentTextOutline",render:function(o,t){return L(),U("svg",vr,t[0]||(t[0]=[y("path",{d:"M416 221.25V416a48 48 0 0 1-48 48H144a48 48 0 0 1-48-48V96a48 48 0 0 1 48-48h98.75a32 32 0 0 1 22.62 9.37l141.26 141.26a32 32 0 0 1 9.37 22.62z",fill:"none",stroke:"currentColor","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M256 56v120a32 32 0 0 0 32 32h120",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M176 288h160"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M176 368h160"},null,-1)]))}}),pr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Je=T({name:"FolderOpenOutline",render:function(o,t){return L(),U("svg",pr,t[0]||(t[0]=[y("path",{d:"M64 192v-72a40 40 0 0 1 40-40h75.89a40 40 0 0 1 22.19 6.72l27.84 18.56a40 40 0 0 0 22.19 6.72H408a40 40 0 0 1 40 40v40",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M479.9 226.55L463.68 392a40 40 0 0 1-39.93 40H88.25a40 40 0 0 1-39.93-40L32.1 226.55A32 32 0 0 1 64 192h384.1a32 32 0 0 1 31.8 34.55z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),gr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},br=T({name:"GridOutline",render:function(o,t){return L(),U("svg",gr,t[0]||(t[0]=[y("rect",{x:"48",y:"48",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("rect",{x:"288",y:"48",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("rect",{x:"48",y:"288",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("rect",{x:"288",y:"288",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),xr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},wr=T({name:"LibraryOutline",render:function(o,t){return L(),U("svg",xr,t[0]||(t[0]=[Ee('<rect x="32" y="96" width="64" height="368" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 224h128"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 400h128"></path><rect x="112" y="160" width="128" height="304" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><rect x="256" y="48" width="96" height="416" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><path d="M422.46 96.11l-40.4 4.25c-11.12 1.17-19.18 11.57-17.93 23.1l34.92 321.59c1.26 11.53 11.37 20 22.49 18.84l40.4-4.25c11.12-1.17 19.18-11.57 17.93-23.1L445 115c-1.31-11.58-11.42-20.06-22.54-18.89z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></path>',6)]))}}),Cr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},yr=T({name:"LogOutOutline",render:function(o,t){return L(),U("svg",Cr,t[0]||(t[0]=[y("path",{d:"M304 336v40a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V136a40 40 0 0 1 40-40h152c22.09 0 48 17.91 48 40v40",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M368 336l80-80l-80-80"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M176 256h256"},null,-1)]))}}),kr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},zr=T({name:"MenuOutline",render:function(o,t){return L(),U("svg",kr,t[0]||(t[0]=[y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 160h352"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 256h352"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 352h352"},null,-1)]))}}),Sr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},gt=T({name:"MoonOutline",render:function(o,t){return L(),U("svg",Sr,t[0]||(t[0]=[y("path",{d:"M160 136c0-30.62 4.51-61.61 16-88C99.57 81.27 48 159.32 48 248c0 119.29 96.71 216 216 216c88.68 0 166.73-51.57 200-128c-26.39 11.49-57.38 16-88 16c-119.29 0-216-96.71-216-216z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),_r={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Ir=T({name:"SettingsOutline",render:function(o,t){return L(),U("svg",_r,t[0]||(t[0]=[y("path",{d:"M262.29 192.31a64 64 0 1 0 57.4 57.4a64.13 64.13 0 0 0-57.4-57.4zM416.39 256a154.34 154.34 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.48 164.48 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22a155.3 155.3 0 0 1-21.46-12.57a16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.48 164.48 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22a155.3 155.3 0 0 1 21.46 12.57a16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0-6.05 14.08c.33 4.14.55 8.3.55 12.47z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),Rr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},bt=T({name:"SunnyOutline",render:function(o,t){return L(),U("svg",Rr,t[0]||(t[0]=[Ee('<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 48v48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 416v48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 108.92l-33.94 33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 369.14l-33.94 33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M464 256h-48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M96 256H48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 403.08l-33.94-33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 142.86l-33.94-33.94"></path><circle cx="256" cy="256" r="80" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"></circle>',9)]))}}),Mr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},$r=T({name:"WarningOutline",render:function(o,t){return L(),U("svg",Mr,t[0]||(t[0]=[y("path",{d:"M85.57 446.25h340.86a32 32 0 0 0 28.17-47.17L284.18 82.58c-12.09-22.44-44.27-22.44-56.36 0L57.4 399.08a32 32 0 0 0 28.17 47.17z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M250.26 195.39l5.74 122l5.73-121.95a5.74 5.74 0 0 0-5.79-6h0a5.74 5.74 0 0 0-5.68 5.95z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M256 397.25a20 20 0 1 1 20-20a20 20 0 0 1-20 20z",fill:"currentColor"},null,-1)]))}}),Tr={auto:"自动",light:"浅色",dark:"深色"},Br={auto:hr,light:bt,dark:gt},Or="外观",Er="theme-menu";function Pr(e){return it.includes(e)}function Ar(e,o,t){return[{label:Or,key:Er,icon:t(o?gt:bt),children:it.map(n=>({key:n,label:Tr[n],icon:t(n===e?pt:Br[n])}))}]}const Nr="project-menu",Hr="项目：",Fe="project:",Lr="project:none",jr="暂无可用项目";function xt(e){return e.startsWith(Fe)}function Fr(e){if(!xt(e))return null;const o=Number(e.slice(Fe.length));return Number.isInteger(o)&&o>0?o:null}function Qe(e){return e.name?.trim()||"未命名项目"}function Dr(e,o,t){const n=e.find(i=>i.id===o)??null;return[{label:`${Hr}${n?Qe(n):"未选择"}`,key:Nr,icon:t(Je),children:e.length?e.map(i=>({key:`${Fe}${i.id}`,label:Qe(i),icon:t(i.id===o?pt:Je)})):[{key:Lr,label:jr,disabled:!0}]}]}const Kr=["src"],Ur={key:0},Vr={class:"topbar-left"},Wr={class:"topbar-title"},Yr={class:"topbar-actions"},Xr={type:"button",class:"user-menu-trigger","aria-label":"打开用户菜单"},Gr={class:"user-summary"},qr={class:"user-name"},Jr={key:0,class:"user-role"},Qr={class:"drawer-brand"},Zr=["src"],en=T({__name:"AppLayout",setup(e){const o=no(),t=lo(),n=qt(),i=Jt(),l=Qt(),v=Zt(),f=D(!1),c=eo("(max-width: 768px)"),g=D(!1),A=()=>{g.value=!1},_=w=>()=>d(Ye,null,{default:()=>d(w)}),s=(w,P,F)=>({label:()=>d(ao,{to:{name:P},onClick:A},{default:()=>w}),key:P,...F?{icon:_(F)}:{}}),O=C(()=>{const w=[s("工作台","dashboard",br),s("备忘录","memos",fr)];return l.isLiteMode?w.push(s("二级库","warehouse-lite",qe)):w.push({label:"二级库",key:"warehouse-group",icon:_(qe),children:[s("库存查询","stock"),s("物资档案","stock-materials"),s("操作记录","operations"),...n.can("warehouse:write")?[s("入库","inbound"),s("出库","outbound")]:[]]}),w.push(s("华星总库存","hua-xing-stock",ar)),w.push({label:"申购管理",key:"procurement-group",icon:_(cr),children:[s("申购计划","purchase-materials"),s("周期性计划","purchase-plan-templates"),s("未编码物资","uncoded-materials"),s("物料编码库","material-code-library"),s("申购记录","purchase-records")]}),w.push({label:"隐患管理",key:"hazard-group",icon:_($r),children:[s("隐患管理","hazard-records"),s("隐患类型","hazard-types"),s("责任单位","hazard-units")]}),w.push({label:"台账管理",key:"ledger-group",icon:_(wr),children:[s("台账总览","ledger-items"),s("标签管理","ledger-tags")]}),n.can("settings:write")&&w.push({label:"系统管理",key:"settings-group",icon:_(Ir),children:[s("管理端用户","users"),s("小程序用户","mini-program-users"),s("项目管理","projects"),s("附件管理","attachments"),s("高级设置","advanced-settings"),s("分享链接","share-links"),s("关于","about")]}),w});function E(){n.logout(),i.clear(),t.push({name:"login"})}const I=C(()=>[...Ar(v.mode,v.isDark,_),...Dr(i.enabledProjects,i.currentProject?.id??null,_),{type:"divider",key:"logout-divider"},{label:"退出登录",key:"logout",icon:_(yr)}]);function $(w){if(w==="logout"){E();return}if(Pr(w)){v.setMode(w);return}if(xt(w)){const P=Fr(w);P!==null&&i.select(P)}}return(w,P)=>{const F=ir,V=Go,R=wo,h=go,b=lt,N=Uo,k=io("router-view"),j=Fo,B=jo,X=Ao;return L(),U(nt,null,[G(B,{"has-sider":!K(c),class:"app-shell"},{default:q(()=>[K(c)?te("",!0):(L(),ce(V,{key:0,bordered:"","collapse-mode":"width","collapsed-width":64,width:180,collapsed:f.value,"show-trigger":"",onCollapse:P[0]||(P[0]=Y=>f.value=!0),onExpand:P[1]||(P[1]=Y=>f.value=!1)},{default:q(()=>[y("div",{class:to(["brand",{compact:f.value}])},[y("img",{class:"brand-mark",src:K(We),alt:"系统 Logo"},null,8,Kr),f.value?te("",!0):(L(),U("span",Ur,"HXNI 电气无忧"))],2),G(F,{collapsed:f.value,"collapsed-width":64,"collapsed-icon-size":22,options:O.value,value:String(K(o).name||"")},null,8,["collapsed","options","value"])]),_:1},8,["collapsed"])),G(B,null,{default:q(()=>[G(N,{bordered:"",class:"topbar"},{default:q(()=>[y("div",Vr,[K(c)?(L(),U("button",{key:0,type:"button",class:"menu-toggle","aria-label":"打开导航菜单",onClick:P[2]||(P[2]=Y=>g.value=!0)},[G(K(Ye),{size:20},{default:q(()=>[G(K(zr))]),_:1})])):te("",!0),y("div",Wr,[G(h,null,{default:q(()=>[!K(c)&&K(o).meta.parent?(L(),ce(R,{key:0},{default:q(()=>[Ue(me(K(o).meta.parent),1)]),_:1})):te("",!0),G(R,null,{default:q(()=>[Ue(me(K(o).meta.title),1)]),_:1})]),_:1})])]),y("div",Yr,[G(b,{options:I.value,onSelect:$},{default:q(()=>[y("button",Xr,[y("span",Gr,[y("span",qr,me(K(n).user?.display_name||K(n).user?.username),1),K(c)?te("",!0):(L(),U("span",Jr,me(K(n).user?K(oo)[K(n).user.role]:""),1))]),P[4]||(P[4]=y("span",{class:"user-menu-caret","aria-hidden":"true"},null,-1))])]),_:1},8,["options"])])]),_:1}),G(j,{class:"app-content","native-scrollbar":!1},{default:q(()=>[G(k,null,{default:q(({Component:Y,route:Z})=>[(L(),ce(ro,null,[Z.meta.keepAlive?(L(),ce(Ve(Y),{key:String(Z.name)})):te("",!0)],1024)),Z.meta.keepAlive?te("",!0):(L(),ce(Ve(Y),{key:0}))]),_:1})]),_:1})]),_:1})]),_:1},8,["has-sider"]),G(X,{show:g.value,"onUpdate:show":P[3]||(P[3]=Y=>g.value=Y),placement:"left",width:250,"aria-label":"导航菜单"},{default:q(()=>[y("div",Qr,[y("img",{class:"brand-mark",src:K(We),alt:"系统 Logo"},null,8,Zr),P[5]||(P[5]=y("span",null,"HXNI 电气无忧",-1))]),G(F,{class:"drawer-menu",options:O.value,value:String(K(o).name||""),"onUpdate:value":A},null,8,["options","value"])]),_:1},8,["show"])],64)}}}),vn=mo(en,[["__scopeId","data-v-bf2771f3"]]);export{vn as default};
