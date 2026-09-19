import{d as $,l as d,m,n as u,p as _,q as p,s as ne,t as J,v as le,x as yo,y as C,z as ae,A as Q,C as re,r as D,D as ko,E as zo,F as So,G as _o,H as ee,I as Re,J as Io,T as Ze,K as eo,S as Te,L as De,M as Ro,N as Me,O as Mo,P as $o,Q as Bo,R as oo,U as Oo,V as To,W as Eo,X as Po,Y as fe,Z as Ao,$ as No,a0 as Ho,a1 as jo,a2 as Lo,a3 as Fo,a4 as W,a5 as Do,a6 as Ko,a7 as Uo,a8 as Vo,a9 as Ke,aa as to,ab as ro,ac as se,ad as Wo,ae as ie,af as Ee,ag as $e,ah as no,ai as _e,aj as Yo,ak as Xo,al as Go,am as qo,o as j,c as K,an as pe,a as y,ao as io,u as Jo,ap as Qo,aq as Zo,ar as et,as as ot,f as G,w as q,b as U,at as ce,au as oe,av as tt,e as Ue,aw as me,ax as rt,ay as Ve,az as nt,h as it,aA as lt,g as at,aB as st}from"./index-lOcKc7k9.js";import{L as We}from"./branding-6zg0tSI6.js";import{u as ue,f as de}from"./get-DoZF1oA6.js";import{N as ct}from"./Tooltip-xc-gLrlR.js";import{N as lo}from"./Dropdown-BKlDfkYW.js";import{V as dt,c as Ie}from"./create-Ds-8sh18.js";import{u as ut}from"./use-compitable-MQFRVxTi.js";import{C as ht}from"./ChevronRight-V6oOWJ51.js";import{N as Ye}from"./Icon-B7UWIwtF.js";import{_ as mt}from"./_plugin-vue_export-helper-DlAUqK2U.js";import"./Popover-B-Ot6IBC.js";import"./use-keyboard-CDD7j-2k.js";const vt=$({name:"ChevronDownFilled",render(){return d("svg",{viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg"},d("path",{d:"M3.20041 5.73966C3.48226 5.43613 3.95681 5.41856 4.26034 5.70041L8 9.22652L11.7397 5.70041C12.0432 5.41856 12.5177 5.43613 12.7996 5.73966C13.0815 6.0432 13.0639 6.51775 12.7603 6.7996L8.51034 10.7996C8.22258 11.0668 7.77743 11.0668 7.48967 10.7996L3.23966 6.7996C2.93613 6.51775 2.91856 6.0432 3.20041 5.73966Z",fill:"currentColor"}))}}),ft=m("breadcrumb",`
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
 `),u("&:not(:last-child)",[_("clickable",[p("link",`
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
 `)])])]),ao=ae("n-breadcrumb"),pt=Object.assign(Object.assign({},J.props),{separator:{type:String,default:"/"}}),gt=$({name:"Breadcrumb",props:pt,setup(e){const{mergedClsPrefixRef:t,inlineThemeDisabled:o}=ne(e),n=J("Breadcrumb","-breadcrumb",ft,yo,e,t);Q(ao,{separatorRef:re(e,"separator"),mergedClsPrefixRef:t});const i=C(()=>{const{common:{cubicBezierEaseInOut:v},self:{separatorColor:f,itemTextColor:c,itemTextColorHover:g,itemTextColorPressed:A,itemTextColorActive:S,fontSize:s,fontWeightActive:T,itemBorderRadius:E,itemColorHover:I,itemColorPressed:B,itemLineHeight:x}}=n.value;return{"--n-font-size":s,"--n-bezier":v,"--n-item-text-color":c,"--n-item-text-color-hover":g,"--n-item-text-color-pressed":A,"--n-item-text-color-active":S,"--n-separator-color":f,"--n-item-color-hover":I,"--n-item-color-pressed":B,"--n-item-border-radius":E,"--n-font-weight-active":T,"--n-item-line-height":x}}),l=o?le("breadcrumb",void 0,i,e):void 0;return{mergedClsPrefix:t,cssVars:o?void 0:i,themeClass:l?.themeClass,onRender:l?.onRender}},render(){var e;return(e=this.onRender)===null||e===void 0||e.call(this),d("nav",{class:[`${this.mergedClsPrefix}-breadcrumb`,this.themeClass],style:this.cssVars,"aria-label":"Breadcrumb"},d("ul",null,this.$slots))}});function bt(e=So?window:null){const t=()=>{const{hash:i,host:l,hostname:v,href:f,origin:c,pathname:g,port:A,protocol:S,search:s}=e?.location||{};return{hash:i,host:l,hostname:v,href:f,origin:c,pathname:g,port:A,protocol:S,search:s}},o=D(t()),n=()=>{o.value=t()};return ko(()=>{e&&(e.addEventListener("popstate",n),e.addEventListener("hashchange",n))}),zo(()=>{e&&(e.removeEventListener("popstate",n),e.removeEventListener("hashchange",n))}),o}const xt={separator:String,href:String,clickable:{type:Boolean,default:!0},showSeparator:{type:Boolean,default:!0},onClick:Function},wt=$({name:"BreadcrumbItem",props:xt,slots:Object,setup(e,{slots:t}){const o=ee(ao,null);if(!o)return()=>null;const{separatorRef:n,mergedClsPrefixRef:i}=o,l=bt(),v=C(()=>e.href?"a":"span"),f=C(()=>l.value.href===e.href?"location":null);return()=>{const{value:c}=i;return d("li",{class:[`${c}-breadcrumb-item`,e.clickable&&`${c}-breadcrumb-item--clickable`]},d(v.value,{class:`${c}-breadcrumb-item__link`,"aria-current":f.value,href:e.href,onClick:e.onClick},t),e.showSeparator&&d("span",{class:`${c}-breadcrumb-item__separator`,"aria-hidden":"true"},_o(t.separator,()=>{var g;return[(g=e.separator)!==null&&g!==void 0?g:n.value]})))}}}),Ct=$({name:"NDrawerContent",inheritAttrs:!1,props:{blockScroll:Boolean,show:{type:Boolean,default:void 0},displayDirective:{type:String,required:!0},placement:{type:String,required:!0},contentClass:String,contentStyle:[Object,String],nativeScrollbar:{type:Boolean,required:!0},scrollbarProps:Object,trapFocus:{type:Boolean,default:!0},autoFocus:{type:Boolean,default:!0},showMask:{type:[Boolean,String],required:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,onClickoutside:Function,onAfterLeave:Function,onAfterEnter:Function,onEsc:Function},setup(e){const t=D(!!e.show),o=D(null),n=ee(oo);let i=0,l="",v=null;const f=D(!1),c=D(!1),g=C(()=>e.placement==="top"||e.placement==="bottom"),{mergedClsPrefixRef:A,mergedRtlRef:S}=ne(e),s=Ro("Drawer",S,A),T=h,E=k=>{c.value=!0,i=g.value?k.clientY:k.clientX,l=document.body.style.cursor,document.body.style.cursor=g.value?"ns-resize":"ew-resize",document.body.addEventListener("mousemove",R),document.body.addEventListener("mouseleave",T),document.body.addEventListener("mouseup",h)},I=()=>{v!==null&&(window.clearTimeout(v),v=null),c.value?f.value=!0:v=window.setTimeout(()=>{f.value=!0},300)},B=()=>{v!==null&&(window.clearTimeout(v),v=null),f.value=!1},{doUpdateHeight:x,doUpdateWidth:P}=n,F=k=>{const{maxWidth:L}=e;if(L&&k>L)return L;const{minWidth:O}=e;return O&&k<O?O:k},V=k=>{const{maxHeight:L}=e;if(L&&k>L)return L;const{minHeight:O}=e;return O&&k<O?O:k};function R(k){var L,O;if(c.value)if(g.value){let X=((L=o.value)===null||L===void 0?void 0:L.offsetHeight)||0;const Y=i-k.clientY;X+=e.placement==="bottom"?Y:-Y,X=V(X),x(X),i=k.clientY}else{let X=((O=o.value)===null||O===void 0?void 0:O.offsetWidth)||0;const Y=i-k.clientX;X+=e.placement==="right"?Y:-Y,X=F(X),P(X),i=k.clientX}}function h(){c.value&&(i=0,c.value=!1,document.body.style.cursor=l,document.body.removeEventListener("mousemove",R),document.body.removeEventListener("mouseup",h),document.body.removeEventListener("mouseleave",T))}Me(()=>{e.show&&(t.value=!0)}),Mo(()=>e.show,k=>{k||h()}),$o(()=>{h()});const b=C(()=>{const{show:k}=e,L=[[De,k]];return e.showMask||L.push([Oo,e.onClickoutside,void 0,{capture:!0}]),L});function N(){var k;t.value=!1,(k=e.onAfterLeave)===null||k===void 0||k.call(e)}return Bo(C(()=>e.blockScroll&&t.value)),Q(To,o),Q(Eo,null),Q(Po,null),{bodyRef:o,rtlEnabled:s,mergedClsPrefix:n.mergedClsPrefixRef,isMounted:n.isMountedRef,mergedTheme:n.mergedThemeRef,displayed:t,transitionName:C(()=>({right:"slide-in-from-right-transition",left:"slide-in-from-left-transition",top:"slide-in-from-top-transition",bottom:"slide-in-from-bottom-transition"})[e.placement]),handleAfterLeave:N,bodyDirectives:b,handleMousedownResizeTrigger:E,handleMouseenterResizeTrigger:I,handleMouseleaveResizeTrigger:B,isDragging:c,isHoverOnResizeTrigger:f}},render(){const{$slots:e,mergedClsPrefix:t}=this;return this.displayDirective==="show"||this.displayed||this.show?Re(d("div",{role:"none"},d(Io,{disabled:!this.showMask||!this.trapFocus,active:this.show,autoFocus:this.autoFocus,onEsc:this.onEsc},{default:()=>d(Ze,{name:this.transitionName,appear:this.isMounted,onAfterEnter:this.onAfterEnter,onAfterLeave:this.handleAfterLeave},{default:()=>Re(d("div",eo(this.$attrs,{role:"dialog",ref:"bodyRef","aria-modal":"true",class:[`${t}-drawer`,this.rtlEnabled&&`${t}-drawer--rtl`,`${t}-drawer--${this.placement}-placement`,this.isDragging&&`${t}-drawer--unselectable`,this.nativeScrollbar&&`${t}-drawer--native-scrollbar`]}),[this.resizable?d("div",{class:[`${t}-drawer__resize-trigger`,(this.isDragging||this.isHoverOnResizeTrigger)&&`${t}-drawer__resize-trigger--hover`],onMouseenter:this.handleMouseenterResizeTrigger,onMouseleave:this.handleMouseleaveResizeTrigger,onMousedown:this.handleMousedownResizeTrigger}):null,this.nativeScrollbar?d("div",{class:[`${t}-drawer-content-wrapper`,this.contentClass],style:this.contentStyle,role:"none"},e):d(Te,Object.assign({},this.scrollbarProps,{contentStyle:this.contentStyle,contentClass:[`${t}-drawer-content-wrapper`,this.contentClass],theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar}),e)]),this.bodyDirectives)})})),[[De,this.displayDirective==="if"||this.displayed||this.show]]):null}}),{cubicBezierEaseIn:yt,cubicBezierEaseOut:kt}=fe;function zt({duration:e="0.3s",leaveDuration:t="0.2s",name:o="slide-in-from-bottom"}={}){return[u(`&.${o}-transition-leave-active`,{transition:`transform ${t} ${yt}`}),u(`&.${o}-transition-enter-active`,{transition:`transform ${e} ${kt}`}),u(`&.${o}-transition-enter-to`,{transform:"translateY(0)"}),u(`&.${o}-transition-enter-from`,{transform:"translateY(100%)"}),u(`&.${o}-transition-leave-from`,{transform:"translateY(0)"}),u(`&.${o}-transition-leave-to`,{transform:"translateY(100%)"})]}const{cubicBezierEaseIn:St,cubicBezierEaseOut:_t}=fe;function It({duration:e="0.3s",leaveDuration:t="0.2s",name:o="slide-in-from-left"}={}){return[u(`&.${o}-transition-leave-active`,{transition:`transform ${t} ${St}`}),u(`&.${o}-transition-enter-active`,{transition:`transform ${e} ${_t}`}),u(`&.${o}-transition-enter-to`,{transform:"translateX(0)"}),u(`&.${o}-transition-enter-from`,{transform:"translateX(-100%)"}),u(`&.${o}-transition-leave-from`,{transform:"translateX(0)"}),u(`&.${o}-transition-leave-to`,{transform:"translateX(-100%)"})]}const{cubicBezierEaseIn:Rt,cubicBezierEaseOut:Mt}=fe;function $t({duration:e="0.3s",leaveDuration:t="0.2s",name:o="slide-in-from-right"}={}){return[u(`&.${o}-transition-leave-active`,{transition:`transform ${t} ${Rt}`}),u(`&.${o}-transition-enter-active`,{transition:`transform ${e} ${Mt}`}),u(`&.${o}-transition-enter-to`,{transform:"translateX(0)"}),u(`&.${o}-transition-enter-from`,{transform:"translateX(100%)"}),u(`&.${o}-transition-leave-from`,{transform:"translateX(0)"}),u(`&.${o}-transition-leave-to`,{transform:"translateX(100%)"})]}const{cubicBezierEaseIn:Bt,cubicBezierEaseOut:Ot}=fe;function Tt({duration:e="0.3s",leaveDuration:t="0.2s",name:o="slide-in-from-top"}={}){return[u(`&.${o}-transition-leave-active`,{transition:`transform ${t} ${Bt}`}),u(`&.${o}-transition-enter-active`,{transition:`transform ${e} ${Ot}`}),u(`&.${o}-transition-enter-to`,{transform:"translateY(0)"}),u(`&.${o}-transition-enter-from`,{transform:"translateY(-100%)"}),u(`&.${o}-transition-leave-from`,{transform:"translateY(0)"}),u(`&.${o}-transition-leave-to`,{transform:"translateY(-100%)"})]}const Et=u([m("drawer",`
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
 `,[$t(),It(),Tt(),zt(),_("unselectable",`
 user-select: none; 
 -webkit-user-select: none;
 `),_("native-scrollbar",[m("drawer-content-wrapper",`
 overflow: auto;
 height: 100%;
 `)]),p("resize-trigger",`
 position: absolute;
 background-color: #0000;
 transition: background-color .3s var(--n-bezier);
 `,[_("hover",`
 background-color: var(--n-resize-trigger-color-hover);
 `)]),m("drawer-content-wrapper",`
 box-sizing: border-box;
 `),m("drawer-content",`
 height: 100%;
 display: flex;
 flex-direction: column;
 `,[_("native-scrollbar",[m("drawer-body-content-wrapper",`
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
 `)]),_("right-placement",`
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
 `)]),_("left-placement",`
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
 `)]),_("top-placement",`
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
 `)]),_("bottom-placement",`
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
 `,[_("invisible",`
 background-color: rgba(0, 0, 0, 0)
 `),Ao({enterDuration:"0.2s",leaveDuration:"0.2s",enterCubicBezier:"var(--n-bezier-in)",leaveCubicBezier:"var(--n-bezier-out)"})])]),Pt=Object.assign(Object.assign({},J.props),{show:Boolean,width:[Number,String],height:[Number,String],placement:{type:String,default:"right"},maskClosable:{type:Boolean,default:!0},showMask:{type:[Boolean,String],default:!0},to:[String,Object],displayDirective:{type:String,default:"if"},nativeScrollbar:{type:Boolean,default:!0},zIndex:Number,onMaskClick:Function,scrollbarProps:Object,contentClass:String,contentStyle:[Object,String],trapFocus:{type:Boolean,default:!0},onEsc:Function,autoFocus:{type:Boolean,default:!0},closeOnEsc:{type:Boolean,default:!0},blockScroll:{type:Boolean,default:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,defaultWidth:{type:[Number,String],default:251},defaultHeight:{type:[Number,String],default:251},onUpdateWidth:[Function,Array],onUpdateHeight:[Function,Array],"onUpdate:width":[Function,Array],"onUpdate:height":[Function,Array],"onUpdate:show":[Function,Array],onUpdateShow:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,drawerStyle:[String,Object],drawerClass:String,target:null,onShow:Function,onHide:Function}),At=$({name:"Drawer",inheritAttrs:!1,props:Pt,setup(e){const{mergedClsPrefixRef:t,namespaceRef:o,inlineThemeDisabled:n}=ne(e),i=Ho(),l=J("Drawer","-drawer",Et,Do,e,t),v=D(e.defaultWidth),f=D(e.defaultHeight),c=ue(re(e,"width"),v),g=ue(re(e,"height"),f),A=C(()=>{const{placement:h}=e;return h==="top"||h==="bottom"?"":de(c.value)}),S=C(()=>{const{placement:h}=e;return h==="left"||h==="right"?"":de(g.value)}),s=h=>{const{onUpdateWidth:b,"onUpdate:width":N}=e;b&&W(b,h),N&&W(N,h),v.value=h},T=h=>{const{onUpdateHeight:b,"onUpdate:width":N}=e;b&&W(b,h),N&&W(N,h),f.value=h},E=C(()=>[{width:A.value,height:S.value},e.drawerStyle||""]);function I(h){const{onMaskClick:b,maskClosable:N}=e;N&&F(!1),b&&b(h)}function B(h){I(h)}const x=jo();function P(h){var b;(b=e.onEsc)===null||b===void 0||b.call(e),e.show&&e.closeOnEsc&&Fo(h)&&(x.value||F(!1))}function F(h){const{onHide:b,onUpdateShow:N,"onUpdate:show":k}=e;N&&W(N,h),k&&W(k,h),b&&!h&&W(b,h)}Q(oo,{isMountedRef:i,mergedThemeRef:l,mergedClsPrefixRef:t,doUpdateShow:F,doUpdateHeight:T,doUpdateWidth:s});const V=C(()=>{const{common:{cubicBezierEaseInOut:h,cubicBezierEaseIn:b,cubicBezierEaseOut:N},self:{color:k,textColor:L,boxShadow:O,lineHeight:X,headerPadding:Y,footerPadding:Z,borderRadius:ge,bodyPadding:be,titleFontSize:xe,titleTextColor:we,titleFontWeight:Ce,headerBorderBottom:ye,footerBorderTop:w,closeIconColor:M,closeIconColorHover:r,closeIconColorPressed:z,closeColorHover:H,closeColorPressed:ke,closeIconSize:ze,closeSize:Se,closeBorderRadius:a,resizableTriggerColorHover:Co}}=l.value;return{"--n-line-height":X,"--n-color":k,"--n-border-radius":ge,"--n-text-color":L,"--n-box-shadow":O,"--n-bezier":h,"--n-bezier-out":N,"--n-bezier-in":b,"--n-header-padding":Y,"--n-body-padding":be,"--n-footer-padding":Z,"--n-title-text-color":we,"--n-title-font-size":xe,"--n-title-font-weight":Ce,"--n-header-border-bottom":ye,"--n-footer-border-top":w,"--n-close-icon-color":M,"--n-close-icon-color-hover":r,"--n-close-icon-color-pressed":z,"--n-close-size":Se,"--n-close-color-hover":H,"--n-close-color-pressed":ke,"--n-close-icon-size":ze,"--n-close-border-radius":a,"--n-resize-trigger-color-hover":Co}}),R=n?le("drawer",void 0,V,e):void 0;return{mergedClsPrefix:t,namespace:o,mergedBodyStyle:E,handleOutsideClick:B,handleMaskClick:I,handleEsc:P,mergedTheme:l,cssVars:n?void 0:V,themeClass:R?.themeClass,onRender:R?.onRender,isMounted:i}},render(){const{mergedClsPrefix:e}=this;return d(No,{to:this.to,show:this.show},{default:()=>{var t;return(t=this.onRender)===null||t===void 0||t.call(this),Re(d("div",{class:[`${e}-drawer-container`,this.namespace,this.themeClass],style:this.cssVars,role:"none"},this.showMask?d(Ze,{name:"fade-in-transition",appear:this.isMounted},{default:()=>this.show?d("div",{"aria-hidden":!0,class:[`${e}-drawer-mask`,this.showMask==="transparent"&&`${e}-drawer-mask--invisible`],onClick:this.handleMaskClick}):null}):null,d(Ct,Object.assign({},this.$attrs,{class:[this.drawerClass,this.$attrs.class],style:[this.mergedBodyStyle,this.$attrs.style],blockScroll:this.blockScroll,contentStyle:this.contentStyle,contentClass:this.contentClass,placement:this.placement,scrollbarProps:this.scrollbarProps,show:this.show,displayDirective:this.displayDirective,nativeScrollbar:this.nativeScrollbar,onAfterEnter:this.onAfterEnter,onAfterLeave:this.onAfterLeave,trapFocus:this.trapFocus,autoFocus:this.autoFocus,resizable:this.resizable,maxHeight:this.maxHeight,minHeight:this.minHeight,maxWidth:this.maxWidth,minWidth:this.minWidth,showMask:this.showMask,onEsc:this.handleEsc,onClickoutside:this.handleOutsideClick}),this.$slots)),[[Lo,{zIndex:this.zIndex,enabled:this.show}]])}})}});function Nt(e){const{baseColor:t,textColor2:o,bodyColor:n,cardColor:i,dividerColor:l,actionColor:v,scrollbarColor:f,scrollbarColorHover:c,invertedColor:g}=e;return{textColor:o,textColorInverted:"#FFF",color:n,colorEmbedded:v,headerColor:i,headerColorInverted:g,footerColor:v,footerColorInverted:g,headerBorderColor:l,headerBorderColorInverted:g,footerBorderColor:l,footerBorderColorInverted:g,siderBorderColor:l,siderBorderColorInverted:g,siderColor:i,siderColorInverted:g,siderToggleButtonBorder:`1px solid ${l}`,siderToggleButtonColor:t,siderToggleButtonIconColor:o,siderToggleButtonIconColorInverted:o,siderToggleBarColor:Ke(n,f),siderToggleBarColorHover:Ke(n,c),__invertScrollbar:"true"}}const Pe=Ko({name:"Layout",common:Vo,peers:{Scrollbar:Uo},self:Nt}),so=ae("n-layout-sider"),Ae={type:String,default:"static"},Ht=m("layout",`
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
 `),_("absolute-positioned",`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),jt={embedded:Boolean,position:Ae,nativeScrollbar:{type:Boolean,default:!0},scrollbarProps:Object,onScroll:Function,contentClass:String,contentStyle:{type:[String,Object],default:""},hasSider:Boolean,siderPlacement:{type:String,default:"left"}},co=ae("n-layout");function uo(e){return $({name:e?"LayoutContent":"Layout",props:Object.assign(Object.assign({},J.props),jt),setup(t){const o=D(null),n=D(null),{mergedClsPrefixRef:i,inlineThemeDisabled:l}=ne(t),v=J("Layout","-layout",Ht,Pe,t,i);function f(I,B){if(t.nativeScrollbar){const{value:x}=o;x&&(B===void 0?x.scrollTo(I):x.scrollTo(I,B))}else{const{value:x}=n;x&&x.scrollTo(I,B)}}Q(co,t);let c=0,g=0;const A=I=>{var B;const x=I.target;c=x.scrollLeft,g=x.scrollTop,(B=t.onScroll)===null||B===void 0||B.call(t,I)};to(()=>{if(t.nativeScrollbar){const I=o.value;I&&(I.scrollTop=g,I.scrollLeft=c)}});const S={display:"flex",flexWrap:"nowrap",width:"100%",flexDirection:"row"},s={scrollTo:f},T=C(()=>{const{common:{cubicBezierEaseInOut:I},self:B}=v.value;return{"--n-bezier":I,"--n-color":t.embedded?B.colorEmbedded:B.color,"--n-text-color":B.textColor}}),E=l?le("layout",C(()=>t.embedded?"e":""),T,t):void 0;return Object.assign({mergedClsPrefix:i,scrollableElRef:o,scrollbarInstRef:n,hasSiderStyle:S,mergedTheme:v,handleNativeElScroll:A,cssVars:l?void 0:T,themeClass:E?.themeClass,onRender:E?.onRender},s)},render(){var t;const{mergedClsPrefix:o,hasSider:n}=this;(t=this.onRender)===null||t===void 0||t.call(this);const i=n?this.hasSiderStyle:void 0,l=[this.themeClass,e&&`${o}-layout-content`,`${o}-layout`,`${o}-layout--${this.position}-positioned`];return d("div",{class:l,style:this.cssVars},this.nativeScrollbar?d("div",{ref:"scrollableElRef",class:[`${o}-layout-scroll-container`,this.contentClass],style:[this.contentStyle,i],onScroll:this.handleNativeElScroll},this.$slots):d(Te,Object.assign({},this.scrollbarProps,{onScroll:this.onScroll,ref:"scrollbarInstRef",theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,contentClass:this.contentClass,contentStyle:[this.contentStyle,i]}),this.$slots))}})}const Lt=uo(!1),Ft=uo(!0),Dt=m("layout-header",`
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
 `)]),Kt={position:Ae,inverted:Boolean,bordered:{type:Boolean,default:!1}},Ut=$({name:"LayoutHeader",props:Object.assign(Object.assign({},J.props),Kt),setup(e){const{mergedClsPrefixRef:t,inlineThemeDisabled:o}=ne(e),n=J("Layout","-layout-header",Dt,Pe,e,t),i=C(()=>{const{common:{cubicBezierEaseInOut:v},self:f}=n.value,c={"--n-bezier":v};return e.inverted?(c["--n-color"]=f.headerColorInverted,c["--n-text-color"]=f.textColorInverted,c["--n-border-color"]=f.headerBorderColorInverted):(c["--n-color"]=f.headerColor,c["--n-text-color"]=f.textColor,c["--n-border-color"]=f.headerBorderColor),c}),l=o?le("layout-header",C(()=>e.inverted?"a":"b"),i,e):void 0;return{mergedClsPrefix:t,cssVars:o?void 0:i,themeClass:l?.themeClass,onRender:l?.onRender}},render(){var e;const{mergedClsPrefix:t}=this;return(e=this.onRender)===null||e===void 0||e.call(this),d("div",{class:[`${t}-layout-header`,this.themeClass,this.position&&`${t}-layout-header--${this.position}-positioned`,this.bordered&&`${t}-layout-header--bordered`],style:this.cssVars},this.$slots)}}),Vt=m("layout-sider",`
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
`,[_("bordered",[p("border",`
 content: "";
 position: absolute;
 top: 0;
 bottom: 0;
 width: 1px;
 background-color: var(--n-border-color);
 transition: background-color .3s var(--n-bezier);
 `)]),p("left-placement",[_("bordered",[p("border",`
 right: 0;
 `)])]),_("right-placement",`
 justify-content: flex-start;
 `,[_("bordered",[p("border",`
 left: 0;
 `)]),_("collapsed",[m("layout-toggle-button",[m("base-icon",`
 transform: rotate(180deg);
 `)]),m("layout-toggle-bar",[u("&:hover",[p("top",{transform:"rotate(-12deg) scale(1.15) translateY(-2px)"}),p("bottom",{transform:"rotate(12deg) scale(1.15) translateY(2px)"})])])]),m("layout-toggle-button",`
 left: 0;
 transform: translateX(-50%) translateY(-50%);
 `,[m("base-icon",`
 transform: rotate(0);
 `)]),m("layout-toggle-bar",`
 left: -28px;
 transform: rotate(180deg);
 `,[u("&:hover",[p("top",{transform:"rotate(12deg) scale(1.15) translateY(-2px)"}),p("bottom",{transform:"rotate(-12deg) scale(1.15) translateY(2px)"})])])]),_("collapsed",[m("layout-toggle-bar",[u("&:hover",[p("top",{transform:"rotate(-12deg) scale(1.15) translateY(-2px)"}),p("bottom",{transform:"rotate(12deg) scale(1.15) translateY(2px)"})])]),m("layout-toggle-button",[m("base-icon",`
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
 `),_("show-content",[m("layout-sider-scroll-container",{opacity:1})]),_("absolute-positioned",`
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 `)]),Wt=$({props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){const{clsPrefix:e}=this;return d("div",{onClick:this.onClick,class:`${e}-layout-toggle-bar`},d("div",{class:`${e}-layout-toggle-bar__top`}),d("div",{class:`${e}-layout-toggle-bar__bottom`}))}}),Yt=$({name:"LayoutToggleButton",props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){const{clsPrefix:e}=this;return d("div",{class:`${e}-layout-toggle-button`,onClick:this.onClick},d(ro,{clsPrefix:e},{default:()=>d(ht,null)}))}}),Xt={position:Ae,bordered:Boolean,collapsedWidth:{type:Number,default:48},width:{type:[Number,String],default:272},contentClass:String,contentStyle:{type:[String,Object],default:""},collapseMode:{type:String,default:"transform"},collapsed:{type:Boolean,default:void 0},defaultCollapsed:Boolean,showCollapsedContent:{type:Boolean,default:!0},showTrigger:{type:[Boolean,String],default:!1},nativeScrollbar:{type:Boolean,default:!0},inverted:Boolean,scrollbarProps:Object,triggerClass:String,triggerStyle:[String,Object],collapsedTriggerClass:String,collapsedTriggerStyle:[String,Object],"onUpdate:collapsed":[Function,Array],onUpdateCollapsed:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,onExpand:[Function,Array],onCollapse:[Function,Array],onScroll:Function},Gt=$({name:"LayoutSider",props:Object.assign(Object.assign({},J.props),Xt),setup(e){const t=ee(co),o=D(null),n=D(null),i=D(e.defaultCollapsed),l=ue(re(e,"collapsed"),i),v=C(()=>de(l.value?e.collapsedWidth:e.width)),f=C(()=>e.collapseMode!=="transform"?{}:{minWidth:de(e.width)}),c=C(()=>t?t.siderPlacement:"left");function g(R,h){if(e.nativeScrollbar){const{value:b}=o;b&&(h===void 0?b.scrollTo(R):b.scrollTo(R,h))}else{const{value:b}=n;b&&b.scrollTo(R,h)}}function A(){const{"onUpdate:collapsed":R,onUpdateCollapsed:h,onExpand:b,onCollapse:N}=e,{value:k}=l;h&&W(h,!k),R&&W(R,!k),i.value=!k,k?b&&W(b):N&&W(N)}let S=0,s=0;const T=R=>{var h;const b=R.target;S=b.scrollLeft,s=b.scrollTop,(h=e.onScroll)===null||h===void 0||h.call(e,R)};to(()=>{if(e.nativeScrollbar){const R=o.value;R&&(R.scrollTop=s,R.scrollLeft=S)}}),Q(so,{collapsedRef:l,collapseModeRef:re(e,"collapseMode")});const{mergedClsPrefixRef:E,inlineThemeDisabled:I}=ne(e),B=J("Layout","-layout-sider",Vt,Pe,e,E);function x(R){var h,b;R.propertyName==="max-width"&&(l.value?(h=e.onAfterLeave)===null||h===void 0||h.call(e):(b=e.onAfterEnter)===null||b===void 0||b.call(e))}const P={scrollTo:g},F=C(()=>{const{common:{cubicBezierEaseInOut:R},self:h}=B.value,{siderToggleButtonColor:b,siderToggleButtonBorder:N,siderToggleBarColor:k,siderToggleBarColorHover:L}=h,O={"--n-bezier":R,"--n-toggle-button-color":b,"--n-toggle-button-border":N,"--n-toggle-bar-color":k,"--n-toggle-bar-color-hover":L};return e.inverted?(O["--n-color"]=h.siderColorInverted,O["--n-text-color"]=h.textColorInverted,O["--n-border-color"]=h.siderBorderColorInverted,O["--n-toggle-button-icon-color"]=h.siderToggleButtonIconColorInverted,O.__invertScrollbar=h.__invertScrollbar):(O["--n-color"]=h.siderColor,O["--n-text-color"]=h.textColor,O["--n-border-color"]=h.siderBorderColor,O["--n-toggle-button-icon-color"]=h.siderToggleButtonIconColor),O}),V=I?le("layout-sider",C(()=>e.inverted?"a":"b"),F,e):void 0;return Object.assign({scrollableElRef:o,scrollbarInstRef:n,mergedClsPrefix:E,mergedTheme:B,styleMaxWidth:v,mergedCollapsed:l,scrollContainerStyle:f,siderPlacement:c,handleNativeElScroll:T,handleTransitionend:x,handleTriggerClick:A,inlineThemeDisabled:I,cssVars:F,themeClass:V?.themeClass,onRender:V?.onRender},P)},render(){var e;const{mergedClsPrefix:t,mergedCollapsed:o,showTrigger:n}=this;return(e=this.onRender)===null||e===void 0||e.call(this),d("aside",{class:[`${t}-layout-sider`,this.themeClass,`${t}-layout-sider--${this.position}-positioned`,`${t}-layout-sider--${this.siderPlacement}-placement`,this.bordered&&`${t}-layout-sider--bordered`,o&&`${t}-layout-sider--collapsed`,(!o||this.showCollapsedContent)&&`${t}-layout-sider--show-content`],onTransitionend:this.handleTransitionend,style:[this.inlineThemeDisabled?void 0:this.cssVars,{maxWidth:this.styleMaxWidth,width:de(this.width)}]},this.nativeScrollbar?d("div",{class:[`${t}-layout-sider-scroll-container`,this.contentClass],onScroll:this.handleNativeElScroll,style:[this.scrollContainerStyle,{overflow:"auto"},this.contentStyle],ref:"scrollableElRef"},this.$slots):d(Te,Object.assign({},this.scrollbarProps,{onScroll:this.onScroll,ref:"scrollbarInstRef",style:this.scrollContainerStyle,contentStyle:this.contentStyle,contentClass:this.contentClass,theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,builtinThemeOverrides:this.inverted&&this.cssVars.__invertScrollbar==="true"?{colorHover:"rgba(255, 255, 255, .4)",color:"rgba(255, 255, 255, .3)"}:void 0}),this.$slots),n?n==="bar"?d(Wt,{clsPrefix:t,class:o?this.collapsedTriggerClass:this.triggerClass,style:o?this.collapsedTriggerStyle:this.triggerStyle,onClick:this.handleTriggerClick}):d(Yt,{clsPrefix:t,class:o?this.collapsedTriggerClass:this.triggerClass,style:o?this.collapsedTriggerStyle:this.triggerStyle,onClick:this.handleTriggerClick}):null,this.bordered?d("div",{class:`${t}-layout-sider__border`}):null)}}),he=ae("n-menu"),ho=ae("n-submenu"),Ne=ae("n-menu-item-group"),Xe=[u("&::before","background-color: var(--n-item-color-hover);"),p("arrow",`
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
 `)])],qt=u([m("menu",`
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
 `,[m("submenu","margin: 0;"),m("menu-item","margin: 0;"),m("menu-item-content",`
 padding: 0 20px;
 border-bottom: 2px solid #0000;
 `,[u("&::before","display: none;"),_("selected","border-bottom: 2px solid var(--n-border-color-horizontal)")]),m("menu-item-content",[_("selected",[p("icon","color: var(--n-item-icon-color-active-horizontal);"),m("menu-item-content-header",`
 color: var(--n-item-text-color-active-horizontal);
 `,[u("a","color: var(--n-item-text-color-active-horizontal);"),p("extra","color: var(--n-item-text-color-active-horizontal);")])]),_("child-active",`
 border-bottom: 2px solid var(--n-border-color-horizontal);
 `,[m("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-horizontal);
 `,[u("a",`
 color: var(--n-item-text-color-child-active-horizontal);
 `),p("extra",`
 color: var(--n-item-text-color-child-active-horizontal);
 `)]),p("icon",`
 color: var(--n-item-icon-color-child-active-horizontal);
 `)]),se("disabled",[se("selected, child-active",[u("&:focus-within",Ge)]),_("selected",[te(null,[p("icon","color: var(--n-item-icon-color-active-hover-horizontal);"),m("menu-item-content-header",`
 color: var(--n-item-text-color-active-hover-horizontal);
 `,[u("a","color: var(--n-item-text-color-active-hover-horizontal);"),p("extra","color: var(--n-item-text-color-active-hover-horizontal);")])])]),_("child-active",[te(null,[p("icon","color: var(--n-item-icon-color-child-active-hover-horizontal);"),m("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-hover-horizontal);
 `,[u("a","color: var(--n-item-text-color-child-active-hover-horizontal);"),p("extra","color: var(--n-item-text-color-child-active-hover-horizontal);")])])]),te("border-bottom: 2px solid var(--n-border-color-horizontal);",Ge)]),m("menu-item-content-header",[u("a","color: var(--n-item-text-color-horizontal);")])])]),se("responsive",[m("menu-item-content-header",`
 overflow: hidden;
 text-overflow: ellipsis;
 `)]),_("collapsed",[m("menu-item-content",[_("selected",[u("&::before",`
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
 `),_("disabled",`
 opacity: .45;
 cursor: not-allowed;
 `),_("collapsed",[p("arrow","transform: rotate(0);")]),_("selected",[u("&::before","background-color: var(--n-item-color-active);"),p("arrow","color: var(--n-arrow-color-active);"),p("icon","color: var(--n-item-icon-color-active);"),m("menu-item-content-header",`
 color: var(--n-item-text-color-active);
 `,[u("a","color: var(--n-item-text-color-active);"),p("extra","color: var(--n-item-text-color-active);")])]),_("child-active",[m("menu-item-content-header",`
 color: var(--n-item-text-color-child-active);
 `,[u("a",`
 color: var(--n-item-text-color-child-active);
 `),p("extra",`
 color: var(--n-item-text-color-child-active);
 `)]),p("arrow",`
 color: var(--n-arrow-color-child-active);
 `),p("icon",`
 color: var(--n-item-icon-color-child-active);
 `)]),se("disabled",[se("selected, child-active",[u("&:focus-within",Xe)]),_("selected",[te(null,[p("arrow","color: var(--n-arrow-color-active-hover);"),p("icon","color: var(--n-item-icon-color-active-hover);"),m("menu-item-content-header",`
 color: var(--n-item-text-color-active-hover);
 `,[u("a","color: var(--n-item-text-color-active-hover);"),p("extra","color: var(--n-item-text-color-active-hover);")])])]),_("child-active",[te(null,[p("arrow","color: var(--n-arrow-color-child-active-hover);"),p("icon","color: var(--n-item-icon-color-child-active-hover);"),m("menu-item-content-header",`
 color: var(--n-item-text-color-child-active-hover);
 `,[u("a","color: var(--n-item-text-color-child-active-hover);"),p("extra","color: var(--n-item-text-color-child-active-hover);")])])]),_("selected",[te(null,[u("&::before","background-color: var(--n-item-color-active-hover);")])]),te(null,Xe)]),p("icon",`
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
 `,[Wo({duration:".2s"})])]),m("menu-item-group",[m("menu-item-group-title",`
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
 `)]);function te(e,t){return[_("hover",e,t),u("&:hover",e,t)]}const mo=$({name:"MenuOptionContent",props:{collapsed:Boolean,disabled:Boolean,title:[String,Function],icon:Function,extra:[String,Function],showArrow:Boolean,childActive:Boolean,hover:Boolean,paddingLeft:Number,selected:Boolean,maxIconSize:{type:Number,required:!0},activeIconSize:{type:Number,required:!0},iconMarginRight:{type:Number,required:!0},clsPrefix:{type:String,required:!0},onClick:Function,tmNode:{type:Object,required:!0},isEllipsisPlaceholder:Boolean},setup(e){const{props:t}=ee(he);return{menuProps:t,style:C(()=>{const{paddingLeft:o}=e;return{paddingLeft:o&&`${o}px`}}),iconStyle:C(()=>{const{maxIconSize:o,activeIconSize:n,iconMarginRight:i}=e;return{width:`${o}px`,height:`${o}px`,fontSize:`${n}px`,marginRight:`${i}px`}})}},render(){const{clsPrefix:e,tmNode:t,menuProps:{renderIcon:o,renderLabel:n,renderExtra:i,expandIcon:l}}=this,v=o?o(t.rawNode):ie(this.icon);return d("div",{onClick:f=>{var c;(c=this.onClick)===null||c===void 0||c.call(this,f)},role:"none",class:[`${e}-menu-item-content`,{[`${e}-menu-item-content--selected`]:this.selected,[`${e}-menu-item-content--collapsed`]:this.collapsed,[`${e}-menu-item-content--child-active`]:this.childActive,[`${e}-menu-item-content--disabled`]:this.disabled,[`${e}-menu-item-content--hover`]:this.hover}],style:this.style},v&&d("div",{class:`${e}-menu-item-content__icon`,style:this.iconStyle,role:"none"},[v]),d("div",{class:`${e}-menu-item-content-header`,role:"none"},this.isEllipsisPlaceholder?this.title:n?n(t.rawNode):ie(this.title),this.extra||i?d("span",{class:`${e}-menu-item-content-header__extra`}," ",i?i(t.rawNode):ie(this.extra)):null),this.showArrow?d(ro,{ariaHidden:!0,class:`${e}-menu-item-content__arrow`,clsPrefix:e},{default:()=>l?l(t.rawNode):d(vt,null)}):null)}}),ve=8;function He(e){const t=ee(he),{props:o,mergedCollapsedRef:n}=t,i=ee(ho,null),l=ee(Ne,null),v=C(()=>o.mode==="horizontal"),f=C(()=>v.value?o.dropdownPlacement:"tmNodes"in e?"right-start":"right"),c=C(()=>{var s;return Math.max((s=o.collapsedIconSize)!==null&&s!==void 0?s:o.iconSize,o.iconSize)}),g=C(()=>{var s;return!v.value&&e.root&&n.value&&(s=o.collapsedIconSize)!==null&&s!==void 0?s:o.iconSize}),A=C(()=>{if(v.value)return;const{collapsedWidth:s,indent:T,rootIndent:E}=o,{root:I,isGroup:B}=e,x=E===void 0?T:E;return I?n.value?s/2-c.value/2:x:l&&typeof l.paddingLeftRef.value=="number"?T/2+l.paddingLeftRef.value:i&&typeof i.paddingLeftRef.value=="number"?(B?T/2:T)+i.paddingLeftRef.value:0}),S=C(()=>{const{collapsedWidth:s,indent:T,rootIndent:E}=o,{value:I}=c,{root:B}=e;return v.value||!B||!n.value?ve:(E===void 0?T:E)+I+ve-(s+I)/2});return{dropdownPlacement:f,activeIconSize:g,maxIconSize:c,paddingLeft:A,iconMarginRight:S,NMenu:t,NSubmenu:i,NMenuOptionGroup:l}}const je={internalKey:{type:[String,Number],required:!0},root:Boolean,isGroup:Boolean,level:{type:Number,required:!0},title:[String,Function],extra:[String,Function]},Jt=$({name:"MenuDivider",setup(){const e=ee(he),{mergedClsPrefixRef:t,isHorizontalRef:o}=e;return()=>o.value?null:d("div",{class:`${t.value}-menu-divider`})}}),vo=Object.assign(Object.assign({},je),{tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function}),Qt=Ee(vo),Zt=$({name:"MenuOption",props:vo,setup(e){const t=He(e),{NSubmenu:o,NMenu:n,NMenuOptionGroup:i}=t,{props:l,mergedClsPrefixRef:v,mergedCollapsedRef:f}=n,c=o?o.mergedDisabledRef:i?i.mergedDisabledRef:{value:!1},g=C(()=>c.value||e.disabled);function A(s){const{onClick:T}=e;T&&T(s)}function S(s){g.value||(n.doSelect(e.internalKey,e.tmNode.rawNode),A(s))}return{mergedClsPrefix:v,dropdownPlacement:t.dropdownPlacement,paddingLeft:t.paddingLeft,iconMarginRight:t.iconMarginRight,maxIconSize:t.maxIconSize,activeIconSize:t.activeIconSize,mergedTheme:n.mergedThemeRef,menuProps:l,dropdownEnabled:$e(()=>e.root&&f.value&&l.mode!=="horizontal"&&!g.value),selected:$e(()=>n.mergedValueRef.value===e.internalKey),mergedDisabled:g,handleClick:S}},render(){const{mergedClsPrefix:e,mergedTheme:t,tmNode:o,menuProps:{renderLabel:n,nodeProps:i}}=this,l=i?.(o.rawNode);return d("div",Object.assign({},l,{role:"menuitem",class:[`${e}-menu-item`,l?.class]}),d(ct,{theme:t.peers.Tooltip,themeOverrides:t.peerOverrides.Tooltip,trigger:"hover",placement:this.dropdownPlacement,disabled:!this.dropdownEnabled||this.title===void 0,internalExtraClass:["menu-tooltip"]},{default:()=>n?n(o.rawNode):ie(this.title),trigger:()=>d(mo,{tmNode:o,clsPrefix:e,paddingLeft:this.paddingLeft,iconMarginRight:this.iconMarginRight,maxIconSize:this.maxIconSize,activeIconSize:this.activeIconSize,selected:this.selected,title:this.title,extra:this.extra,disabled:this.mergedDisabled,icon:this.icon,onClick:this.handleClick})}))}}),fo=Object.assign(Object.assign({},je),{tmNode:{type:Object,required:!0},tmNodes:{type:Array,required:!0}}),er=Ee(fo),or=$({name:"MenuOptionGroup",props:fo,setup(e){const t=He(e),{NSubmenu:o}=t,n=C(()=>o?.mergedDisabledRef.value?!0:e.tmNode.disabled);Q(Ne,{paddingLeftRef:t.paddingLeft,mergedDisabledRef:n});const{mergedClsPrefixRef:i,props:l}=ee(he);return function(){const{value:v}=i,f=t.paddingLeft.value,{nodeProps:c}=l,g=c?.(e.tmNode.rawNode);return d("div",{class:`${v}-menu-item-group`,role:"group"},d("div",Object.assign({},g,{class:[`${v}-menu-item-group-title`,g?.class],style:[g?.style||"",f!==void 0?`padding-left: ${f}px;`:""]}),ie(e.title),e.extra?d(no,null," ",ie(e.extra)):null),d("div",null,e.tmNodes.map(A=>Le(A,l))))}}});function Be(e){return e.type==="divider"||e.type==="render"}function tr(e){return e.type==="divider"}function Le(e,t){const{rawNode:o}=e,{show:n}=o;if(n===!1)return null;if(Be(o))return tr(o)?d(Jt,Object.assign({key:e.key},o.props)):null;const{labelField:i}=t,{key:l,level:v,isGroup:f}=e,c=Object.assign(Object.assign({},o),{title:o.title||o[i],extra:o.titleExtra||o.extra,key:l,internalKey:l,level:v,root:v===0,isGroup:f});return e.children?e.isGroup?d(or,_e(c,er,{tmNode:e,tmNodes:e.children,key:l})):d(Oe,_e(c,rr,{key:l,rawNodes:o[t.childrenField],tmNodes:e.children,tmNode:e})):d(Zt,_e(c,Qt,{key:l,tmNode:e}))}const po=Object.assign(Object.assign({},je),{rawNodes:{type:Array,default:()=>[]},tmNodes:{type:Array,default:()=>[]},tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function,domId:String,virtualChildActive:{type:Boolean,default:void 0},isEllipsisPlaceholder:Boolean}),rr=Ee(po),Oe=$({name:"Submenu",props:po,setup(e){const t=He(e),{NMenu:o,NSubmenu:n}=t,{props:i,mergedCollapsedRef:l,mergedThemeRef:v}=o,f=C(()=>{const{disabled:s}=e;return n?.mergedDisabledRef.value||i.disabled?!0:s}),c=D(!1);Q(ho,{paddingLeftRef:t.paddingLeft,mergedDisabledRef:f}),Q(Ne,null);function g(){const{onClick:s}=e;s&&s()}function A(){f.value||(l.value||o.toggleExpand(e.internalKey),g())}function S(s){c.value=s}return{menuProps:i,mergedTheme:v,doSelect:o.doSelect,inverted:o.invertedRef,isHorizontal:o.isHorizontalRef,mergedClsPrefix:o.mergedClsPrefixRef,maxIconSize:t.maxIconSize,activeIconSize:t.activeIconSize,iconMarginRight:t.iconMarginRight,dropdownPlacement:t.dropdownPlacement,dropdownShow:c,paddingLeft:t.paddingLeft,mergedDisabled:f,mergedValue:o.mergedValueRef,childActive:$e(()=>{var s;return(s=e.virtualChildActive)!==null&&s!==void 0?s:o.activePathRef.value.includes(e.internalKey)}),collapsed:C(()=>i.mode==="horizontal"?!1:l.value?!0:!o.mergedExpandedKeysRef.value.includes(e.internalKey)),dropdownEnabled:C(()=>!f.value&&(i.mode==="horizontal"||l.value)),handlePopoverShowChange:S,handleClick:A}},render(){var e;const{mergedClsPrefix:t,menuProps:{renderIcon:o,renderLabel:n}}=this,i=()=>{const{isHorizontal:v,paddingLeft:f,collapsed:c,mergedDisabled:g,maxIconSize:A,activeIconSize:S,title:s,childActive:T,icon:E,handleClick:I,menuProps:{nodeProps:B},dropdownShow:x,iconMarginRight:P,tmNode:F,mergedClsPrefix:V,isEllipsisPlaceholder:R,extra:h}=this,b=B?.(F.rawNode);return d("div",Object.assign({},b,{class:[`${V}-menu-item`,b?.class],role:"menuitem"}),d(mo,{tmNode:F,paddingLeft:f,collapsed:c,disabled:g,iconMarginRight:P,maxIconSize:A,activeIconSize:S,title:s,extra:h,showArrow:!v,childActive:T,clsPrefix:V,icon:E,hover:x,onClick:I,isEllipsisPlaceholder:R}))},l=()=>d(Yo,null,{default:()=>{const{tmNodes:v,collapsed:f}=this;return f?null:d("div",{class:`${t}-submenu-children`,role:"menu"},v.map(c=>Le(c,this.menuProps)))}});return this.root?d(lo,Object.assign({size:"large",trigger:"hover"},(e=this.menuProps)===null||e===void 0?void 0:e.dropdownProps,{themeOverrides:this.mergedTheme.peerOverrides.Dropdown,theme:this.mergedTheme.peers.Dropdown,builtinThemeOverrides:{fontSizeLarge:"14px",optionIconSizeLarge:"18px"},value:this.mergedValue,disabled:!this.dropdownEnabled,placement:this.dropdownPlacement,keyField:this.menuProps.keyField,labelField:this.menuProps.labelField,childrenField:this.menuProps.childrenField,onUpdateShow:this.handlePopoverShowChange,options:this.rawNodes,onSelect:this.doSelect,inverted:this.inverted,renderIcon:o,renderLabel:n}),{default:()=>d("div",{class:`${t}-submenu`,role:"menu","aria-expanded":!this.collapsed,id:this.domId},i(),this.isHorizontal?null:l())}):d("div",{class:`${t}-submenu`,role:"menu","aria-expanded":!this.collapsed,id:this.domId},i(),l())}}),nr=Object.assign(Object.assign({},J.props),{options:{type:Array,default:()=>[]},collapsed:{type:Boolean,default:void 0},collapsedWidth:{type:Number,default:48},iconSize:{type:Number,default:20},collapsedIconSize:{type:Number,default:24},rootIndent:Number,indent:{type:Number,default:32},labelField:{type:String,default:"label"},keyField:{type:String,default:"key"},childrenField:{type:String,default:"children"},disabledField:{type:String,default:"disabled"},defaultExpandAll:Boolean,defaultExpandedKeys:Array,expandedKeys:Array,value:[String,Number],defaultValue:{type:[String,Number],default:null},mode:{type:String,default:"vertical"},watchProps:{type:Array,default:void 0},disabled:Boolean,show:{type:Boolean,default:!0},inverted:Boolean,"onUpdate:expandedKeys":[Function,Array],onUpdateExpandedKeys:[Function,Array],onUpdateValue:[Function,Array],"onUpdate:value":[Function,Array],expandIcon:Function,renderIcon:Function,renderLabel:Function,renderExtra:Function,dropdownProps:Object,accordion:Boolean,nodeProps:Function,dropdownPlacement:{type:String,default:"bottom"},responsive:Boolean,items:Array,onOpenNamesChange:[Function,Array],onSelect:[Function,Array],onExpandedNamesChange:[Function,Array],expandedNames:Array,defaultExpandedNames:Array}),ir=$({name:"Menu",inheritAttrs:!1,props:nr,setup(e){const{mergedClsPrefixRef:t,inlineThemeDisabled:o}=ne(e),n=J("Menu","-menu",qt,qo,e,t),i=ee(so,null),l=C(()=>{var w;const{collapsed:M}=e;if(M!==void 0)return M;if(i){const{collapseModeRef:r,collapsedRef:z}=i;if(r.value==="width")return(w=z.value)!==null&&w!==void 0?w:!1}return!1}),v=C(()=>{const{keyField:w,childrenField:M,disabledField:r}=e;return Ie(e.items||e.options,{getIgnored(z){return Be(z)},getChildren(z){return z[M]},getDisabled(z){return z[r]},getKey(z){var H;return(H=z[w])!==null&&H!==void 0?H:z.name}})}),f=C(()=>new Set(v.value.treeNodes.map(w=>w.key))),{watchProps:c}=e,g=D(null);c?.includes("defaultValue")?Me(()=>{g.value=e.defaultValue}):g.value=e.defaultValue;const A=re(e,"value"),S=ue(A,g),s=D([]),T=()=>{s.value=e.defaultExpandAll?v.value.getNonLeafKeys():e.defaultExpandedNames||e.defaultExpandedKeys||v.value.getPath(S.value,{includeSelf:!1}).keyPath};c?.includes("defaultExpandedKeys")?Me(T):T();const E=ut(e,["expandedNames","expandedKeys"]),I=ue(E,s),B=C(()=>v.value.treeNodes),x=C(()=>v.value.getPath(S.value).keyPath);Q(he,{props:e,mergedCollapsedRef:l,mergedThemeRef:n,mergedValueRef:S,mergedExpandedKeysRef:I,activePathRef:x,mergedClsPrefixRef:t,isHorizontalRef:C(()=>e.mode==="horizontal"),invertedRef:re(e,"inverted"),doSelect:P,toggleExpand:V});function P(w,M){const{"onUpdate:value":r,onUpdateValue:z,onSelect:H}=e;z&&W(z,w,M),r&&W(r,w,M),H&&W(H,w,M),g.value=w}function F(w){const{"onUpdate:expandedKeys":M,onUpdateExpandedKeys:r,onExpandedNamesChange:z,onOpenNamesChange:H}=e;M&&W(M,w),r&&W(r,w),z&&W(z,w),H&&W(H,w),s.value=w}function V(w){const M=Array.from(I.value),r=M.findIndex(z=>z===w);if(~r)M.splice(r,1);else{if(e.accordion&&f.value.has(w)){const z=M.findIndex(H=>f.value.has(H));z>-1&&M.splice(z,1)}M.push(w)}F(M)}const R=w=>{const M=v.value.getPath(w??S.value,{includeSelf:!1}).keyPath;if(!M.length)return;const r=Array.from(I.value),z=new Set([...r,...M]);e.accordion&&f.value.forEach(H=>{z.has(H)&&!M.includes(H)&&z.delete(H)}),F(Array.from(z))},h=C(()=>{const{inverted:w}=e,{common:{cubicBezierEaseInOut:M},self:r}=n.value,{borderRadius:z,borderColorHorizontal:H,fontSize:ke,itemHeight:ze,dividerColor:Se}=r,a={"--n-divider-color":Se,"--n-bezier":M,"--n-font-size":ke,"--n-border-color-horizontal":H,"--n-border-radius":z,"--n-item-height":ze};return w?(a["--n-group-text-color"]=r.groupTextColorInverted,a["--n-color"]=r.colorInverted,a["--n-item-text-color"]=r.itemTextColorInverted,a["--n-item-text-color-hover"]=r.itemTextColorHoverInverted,a["--n-item-text-color-active"]=r.itemTextColorActiveInverted,a["--n-item-text-color-child-active"]=r.itemTextColorChildActiveInverted,a["--n-item-text-color-child-active-hover"]=r.itemTextColorChildActiveInverted,a["--n-item-text-color-active-hover"]=r.itemTextColorActiveHoverInverted,a["--n-item-icon-color"]=r.itemIconColorInverted,a["--n-item-icon-color-hover"]=r.itemIconColorHoverInverted,a["--n-item-icon-color-active"]=r.itemIconColorActiveInverted,a["--n-item-icon-color-active-hover"]=r.itemIconColorActiveHoverInverted,a["--n-item-icon-color-child-active"]=r.itemIconColorChildActiveInverted,a["--n-item-icon-color-child-active-hover"]=r.itemIconColorChildActiveHoverInverted,a["--n-item-icon-color-collapsed"]=r.itemIconColorCollapsedInverted,a["--n-item-text-color-horizontal"]=r.itemTextColorHorizontalInverted,a["--n-item-text-color-hover-horizontal"]=r.itemTextColorHoverHorizontalInverted,a["--n-item-text-color-active-horizontal"]=r.itemTextColorActiveHorizontalInverted,a["--n-item-text-color-child-active-horizontal"]=r.itemTextColorChildActiveHorizontalInverted,a["--n-item-text-color-child-active-hover-horizontal"]=r.itemTextColorChildActiveHoverHorizontalInverted,a["--n-item-text-color-active-hover-horizontal"]=r.itemTextColorActiveHoverHorizontalInverted,a["--n-item-icon-color-horizontal"]=r.itemIconColorHorizontalInverted,a["--n-item-icon-color-hover-horizontal"]=r.itemIconColorHoverHorizontalInverted,a["--n-item-icon-color-active-horizontal"]=r.itemIconColorActiveHorizontalInverted,a["--n-item-icon-color-active-hover-horizontal"]=r.itemIconColorActiveHoverHorizontalInverted,a["--n-item-icon-color-child-active-horizontal"]=r.itemIconColorChildActiveHorizontalInverted,a["--n-item-icon-color-child-active-hover-horizontal"]=r.itemIconColorChildActiveHoverHorizontalInverted,a["--n-arrow-color"]=r.arrowColorInverted,a["--n-arrow-color-hover"]=r.arrowColorHoverInverted,a["--n-arrow-color-active"]=r.arrowColorActiveInverted,a["--n-arrow-color-active-hover"]=r.arrowColorActiveHoverInverted,a["--n-arrow-color-child-active"]=r.arrowColorChildActiveInverted,a["--n-arrow-color-child-active-hover"]=r.arrowColorChildActiveHoverInverted,a["--n-item-color-hover"]=r.itemColorHoverInverted,a["--n-item-color-active"]=r.itemColorActiveInverted,a["--n-item-color-active-hover"]=r.itemColorActiveHoverInverted,a["--n-item-color-active-collapsed"]=r.itemColorActiveCollapsedInverted):(a["--n-group-text-color"]=r.groupTextColor,a["--n-color"]=r.color,a["--n-item-text-color"]=r.itemTextColor,a["--n-item-text-color-hover"]=r.itemTextColorHover,a["--n-item-text-color-active"]=r.itemTextColorActive,a["--n-item-text-color-child-active"]=r.itemTextColorChildActive,a["--n-item-text-color-child-active-hover"]=r.itemTextColorChildActiveHover,a["--n-item-text-color-active-hover"]=r.itemTextColorActiveHover,a["--n-item-icon-color"]=r.itemIconColor,a["--n-item-icon-color-hover"]=r.itemIconColorHover,a["--n-item-icon-color-active"]=r.itemIconColorActive,a["--n-item-icon-color-active-hover"]=r.itemIconColorActiveHover,a["--n-item-icon-color-child-active"]=r.itemIconColorChildActive,a["--n-item-icon-color-child-active-hover"]=r.itemIconColorChildActiveHover,a["--n-item-icon-color-collapsed"]=r.itemIconColorCollapsed,a["--n-item-text-color-horizontal"]=r.itemTextColorHorizontal,a["--n-item-text-color-hover-horizontal"]=r.itemTextColorHoverHorizontal,a["--n-item-text-color-active-horizontal"]=r.itemTextColorActiveHorizontal,a["--n-item-text-color-child-active-horizontal"]=r.itemTextColorChildActiveHorizontal,a["--n-item-text-color-child-active-hover-horizontal"]=r.itemTextColorChildActiveHoverHorizontal,a["--n-item-text-color-active-hover-horizontal"]=r.itemTextColorActiveHoverHorizontal,a["--n-item-icon-color-horizontal"]=r.itemIconColorHorizontal,a["--n-item-icon-color-hover-horizontal"]=r.itemIconColorHoverHorizontal,a["--n-item-icon-color-active-horizontal"]=r.itemIconColorActiveHorizontal,a["--n-item-icon-color-active-hover-horizontal"]=r.itemIconColorActiveHoverHorizontal,a["--n-item-icon-color-child-active-horizontal"]=r.itemIconColorChildActiveHorizontal,a["--n-item-icon-color-child-active-hover-horizontal"]=r.itemIconColorChildActiveHoverHorizontal,a["--n-arrow-color"]=r.arrowColor,a["--n-arrow-color-hover"]=r.arrowColorHover,a["--n-arrow-color-active"]=r.arrowColorActive,a["--n-arrow-color-active-hover"]=r.arrowColorActiveHover,a["--n-arrow-color-child-active"]=r.arrowColorChildActive,a["--n-arrow-color-child-active-hover"]=r.arrowColorChildActiveHover,a["--n-item-color-hover"]=r.itemColorHover,a["--n-item-color-active"]=r.itemColorActive,a["--n-item-color-active-hover"]=r.itemColorActiveHover,a["--n-item-color-active-collapsed"]=r.itemColorActiveCollapsed),a}),b=o?le("menu",C(()=>e.inverted?"a":"b"),h,e):void 0,N=Go(),k=D(null),L=D(null);let O=!0;const X=()=>{var w;O?O=!1:(w=k.value)===null||w===void 0||w.sync({showAllItemsBeforeCalculate:!0})};function Y(){return document.getElementById(N)}const Z=D(-1);function ge(w){Z.value=e.options.length-w}function be(w){w||(Z.value=-1)}const xe=C(()=>{const w=Z.value;return{children:w===-1?[]:e.options.slice(w)}}),we=C(()=>{const{childrenField:w,disabledField:M,keyField:r}=e;return Ie([xe.value],{getIgnored(z){return Be(z)},getChildren(z){return z[w]},getDisabled(z){return z[M]},getKey(z){var H;return(H=z[r])!==null&&H!==void 0?H:z.name}})}),Ce=C(()=>Ie([{}]).treeNodes[0]);function ye(){var w;if(Z.value===-1)return d(Oe,{root:!0,level:0,key:"__ellpisisGroupPlaceholder__",internalKey:"__ellpisisGroupPlaceholder__",title:"···",tmNode:Ce.value,domId:N,isEllipsisPlaceholder:!0});const M=we.value.treeNodes[0],r=x.value,z=!!(!((w=M.children)===null||w===void 0)&&w.some(H=>r.includes(H.key)));return d(Oe,{level:0,root:!0,key:"__ellpisisGroup__",internalKey:"__ellpisisGroup__",title:"···",virtualChildActive:z,tmNode:M,domId:N,rawNodes:M.rawNode.children||[],tmNodes:M.children||[],isEllipsisPlaceholder:!0})}return{mergedClsPrefix:t,controlledExpandedKeys:E,uncontrolledExpanededKeys:s,mergedExpandedKeys:I,uncontrolledValue:g,mergedValue:S,activePath:x,tmNodes:B,mergedTheme:n,mergedCollapsed:l,cssVars:o?void 0:h,themeClass:b?.themeClass,overflowRef:k,counterRef:L,updateCounter:()=>{},onResize:X,onUpdateOverflow:be,onUpdateCount:ge,renderCounter:ye,getCounter:Y,onRender:b?.onRender,showOption:R,deriveResponsiveState:X}},render(){const{mergedClsPrefix:e,mode:t,themeClass:o,onRender:n}=this;n?.();const i=()=>this.tmNodes.map(c=>Le(c,this.$props)),v=t==="horizontal"&&this.responsive,f=()=>d("div",eo(this.$attrs,{role:t==="horizontal"?"menubar":"menu",class:[`${e}-menu`,o,`${e}-menu--${t}`,v&&`${e}-menu--responsive`,this.mergedCollapsed&&`${e}-menu--collapsed`],style:this.cssVars}),v?d(dt,{ref:"overflowRef",onUpdateOverflow:this.onUpdateOverflow,getCounter:this.getCounter,onUpdateCount:this.onUpdateCount,updateCounter:this.updateCounter,style:{width:"100%",display:"flex",overflow:"hidden"}},{default:i,counter:this.renderCounter}):i());return v?d(Xo,{onResize:this.onResize},{default:f}):f()}}),lr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},ar=$({name:"BusinessOutline",render:function(t,o){return j(),K("svg",lr,o[0]||(o[0]=[pe('<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M176 416v64"></path><path d="M80 32h192a32 32 0 0 1 32 32v412a4 4 0 0 1-4 4H48h0V64a32 32 0 0 1 32-32z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path><path d="M320 192h112a32 32 0 0 1 32 32v256h0h-160h0V208a16 16 0 0 1 16-16z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path><path d="M98.08 431.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 351.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 271.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 191.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M98.08 111.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 351.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 271.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 191.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M178.08 111.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M258.08 431.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M258.08 351.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M258.08 271.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><ellipse cx="256" cy="176" rx="15.95" ry="16.03" transform="rotate(-45 255.99 175.996)" fill="currentColor"></ellipse><path d="M258.08 111.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79z" fill="currentColor"></path><path d="M400 400a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M400 320a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M400 240a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M336 400a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M336 320a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path><path d="M336 240a16 16 0 1 0 16 16a16 16 0 0 0-16-16z" fill="currentColor"></path>',23)]))}}),sr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},cr=$({name:"CalendarOutline",render:function(t,o){return j(),K("svg",sr,o[0]||(o[0]=[pe('<rect fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" x="48" y="80" width="416" height="384" rx="48"></rect><circle cx="296" cy="232" r="24" fill="currentColor"></circle><circle cx="376" cy="232" r="24" fill="currentColor"></circle><circle cx="296" cy="312" r="24" fill="currentColor"></circle><circle cx="376" cy="312" r="24" fill="currentColor"></circle><circle cx="136" cy="312" r="24" fill="currentColor"></circle><circle cx="216" cy="312" r="24" fill="currentColor"></circle><circle cx="136" cy="392" r="24" fill="currentColor"></circle><circle cx="216" cy="392" r="24" fill="currentColor"></circle><circle cx="296" cy="392" r="24" fill="currentColor"></circle><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" stroke-linecap="round" d="M128 48v32"></path><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" stroke-linecap="round" d="M384 48v32"></path><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" d="M464 160H48"></path>',13)]))}}),dr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},ur=$({name:"CartOutline",render:function(t,o){return j(),K("svg",dr,o[0]||(o[0]=[y("circle",{cx:"176",cy:"416",r:"16",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("circle",{cx:"400",cy:"416",r:"16",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M48 80h64l48 272h256"},null,-1),y("path",{d:"M160 288h249.44a8 8 0 0 0 7.85-6.43l28.8-144a8 8 0 0 0-7.85-9.57H128",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),hr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},go=$({name:"CheckmarkOutline",render:function(t,o){return j(),K("svg",hr,o[0]||(o[0]=[y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M416 128L192 384l-96-96"},null,-1)]))}}),mr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},vr=$({name:"ContrastOutline",render:function(t,o){return j(),K("svg",mr,o[0]||(o[0]=[y("circle",{cx:"256",cy:"256",r:"208",fill:"none",stroke:"currentColor","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M256 464c-114.88 0-208-93.12-208-208S141.12 48 256 48z",fill:"currentColor"},null,-1)]))}}),fr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},qe=$({name:"CubeOutline",render:function(t,o){return j(),K("svg",fr,o[0]||(o[0]=[y("path",{d:"M448 341.37V170.61A32 32 0 0 0 432.11 143l-152-88.46a47.94 47.94 0 0 0-48.24 0L79.89 143A32 32 0 0 0 64 170.61v170.76A32 32 0 0 0 79.89 369l152 88.46a48 48 0 0 0 48.24 0l152-88.46A32 32 0 0 0 448 341.37z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M69 153.99l187 110l187-110"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M256 463.99v-200"},null,-1)]))}}),pr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},gr=$({name:"DocumentTextOutline",render:function(t,o){return j(),K("svg",pr,o[0]||(o[0]=[y("path",{d:"M416 221.25V416a48 48 0 0 1-48 48H144a48 48 0 0 1-48-48V96a48 48 0 0 1 48-48h98.75a32 32 0 0 1 22.62 9.37l141.26 141.26a32 32 0 0 1 9.37 22.62z",fill:"none",stroke:"currentColor","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M256 56v120a32 32 0 0 0 32 32h120",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M176 288h160"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M176 368h160"},null,-1)]))}}),br={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Je=$({name:"FolderOpenOutline",render:function(t,o){return j(),K("svg",br,o[0]||(o[0]=[y("path",{d:"M64 192v-72a40 40 0 0 1 40-40h75.89a40 40 0 0 1 22.19 6.72l27.84 18.56a40 40 0 0 0 22.19 6.72H408a40 40 0 0 1 40 40v40",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M479.9 226.55L463.68 392a40 40 0 0 1-39.93 40H88.25a40 40 0 0 1-39.93-40L32.1 226.55A32 32 0 0 1 64 192h384.1a32 32 0 0 1 31.8 34.55z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),xr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},wr=$({name:"GridOutline",render:function(t,o){return j(),K("svg",xr,o[0]||(o[0]=[y("rect",{x:"48",y:"48",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("rect",{x:"288",y:"48",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("rect",{x:"48",y:"288",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("rect",{x:"288",y:"288",width:"176",height:"176",rx:"20",ry:"20",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),Cr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},yr=$({name:"LibraryOutline",render:function(t,o){return j(),K("svg",Cr,o[0]||(o[0]=[pe('<rect x="32" y="96" width="64" height="368" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 224h128"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 400h128"></path><rect x="112" y="160" width="128" height="304" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><rect x="256" y="48" width="96" height="416" rx="16" ry="16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><path d="M422.46 96.11l-40.4 4.25c-11.12 1.17-19.18 11.57-17.93 23.1l34.92 321.59c1.26 11.53 11.37 20 22.49 18.84l40.4-4.25c11.12-1.17 19.18-11.57 17.93-23.1L445 115c-1.31-11.58-11.42-20.06-22.54-18.89z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></path>',6)]))}}),kr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},zr=$({name:"LogOutOutline",render:function(t,o){return j(),K("svg",kr,o[0]||(o[0]=[y("path",{d:"M304 336v40a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V136a40 40 0 0 1 40-40h152c22.09 0 48 17.91 48 40v40",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M368 336l80-80l-80-80"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32",d:"M176 256h256"},null,-1)]))}}),Sr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},_r=$({name:"MenuOutline",render:function(t,o){return j(),K("svg",Sr,o[0]||(o[0]=[y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 160h352"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 256h352"},null,-1),y("path",{fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-miterlimit":"10","stroke-width":"32",d:"M80 352h352"},null,-1)]))}}),Ir={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},bo=$({name:"MoonOutline",render:function(t,o){return j(),K("svg",Ir,o[0]||(o[0]=[y("path",{d:"M160 136c0-30.62 4.51-61.61 16-88C99.57 81.27 48 159.32 48 248c0 119.29 96.71 216 216 216c88.68 0 166.73-51.57 200-128c-26.39 11.49-57.38 16-88 16c-119.29 0-216-96.71-216-216z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),Rr={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Mr=$({name:"SettingsOutline",render:function(t,o){return j(),K("svg",Rr,o[0]||(o[0]=[y("path",{d:"M262.29 192.31a64 64 0 1 0 57.4 57.4a64.13 64.13 0 0 0-57.4-57.4zM416.39 256a154.34 154.34 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.48 164.48 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22a155.3 155.3 0 0 1-21.46-12.57a16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.48 164.48 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22a155.3 155.3 0 0 1 21.46 12.57a16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0-6.05 14.08c.33 4.14.55 8.3.55 12.47z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1)]))}}),$r={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},xo=$({name:"SunnyOutline",render:function(t,o){return j(),K("svg",$r,o[0]||(o[0]=[pe('<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 48v48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M256 416v48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 108.92l-33.94 33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 369.14l-33.94 33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M464 256h-48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M96 256H48"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M403.08 403.08l-33.94-33.94"></path><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M142.86 142.86l-33.94-33.94"></path><circle cx="256" cy="256" r="80" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"></circle>',9)]))}}),Br={xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink",viewBox:"0 0 512 512"},Or=$({name:"WarningOutline",render:function(t,o){return j(),K("svg",Br,o[0]||(o[0]=[y("path",{d:"M85.57 446.25h340.86a32 32 0 0 0 28.17-47.17L284.18 82.58c-12.09-22.44-44.27-22.44-56.36 0L57.4 399.08a32 32 0 0 0 28.17 47.17z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M250.26 195.39l5.74 122l5.73-121.95a5.74 5.74 0 0 0-5.79-6h0a5.74 5.74 0 0 0-5.68 5.95z",fill:"none",stroke:"currentColor","stroke-linecap":"round","stroke-linejoin":"round","stroke-width":"32"},null,-1),y("path",{d:"M256 397.25a20 20 0 1 1 20-20a20 20 0 0 1-20 20z",fill:"currentColor"},null,-1)]))}}),Tr={auto:"自动",light:"浅色",dark:"深色"},Er={auto:vr,light:xo,dark:bo},Pr="外观",Ar="theme-menu";function Nr(e){return io.includes(e)}function Hr(e,t,o){return[{label:Pr,key:Ar,icon:o(t?bo:xo),children:io.map(n=>({key:n,label:Tr[n],icon:o(n===e?go:Er[n])}))}]}const jr="project-menu",Lr="项目：",Fe="project:",Fr="project:none",Dr="暂无可用项目";function wo(e){return e.startsWith(Fe)}function Kr(e){if(!wo(e))return null;const t=Number(e.slice(Fe.length));return Number.isInteger(t)&&t>0?t:null}function Qe(e){return e.name?.trim()||"未命名项目"}function Ur(e,t,o){const n=e.find(i=>i.id===t)??null;return[{label:`${Lr}${n?Qe(n):"未选择"}`,key:jr,icon:o(Je),children:e.length?e.map(i=>({key:`${Fe}${i.id}`,label:Qe(i),icon:o(i.id===t?go:Je)})):[{key:Fr,label:Dr,disabled:!0}]}]}const Vr=["src"],Wr={key:0},Yr={class:"topbar-left"},Xr={class:"topbar-title"},Gr={class:"topbar-actions"},qr={type:"button",class:"user-menu-trigger","aria-label":"打开用户菜单"},Jr={class:"user-summary"},Qr={class:"user-name"},Zr={key:0,class:"user-role"},en={class:"drawer-brand"},on=["src"],tn=$({__name:"AppLayout",setup(e){const t=it(),o=at(),n=Jo(),i=Qo(),l=Zo(),v=et(),f=D(!1),c=ot("(max-width: 768px)"),g=D(!1),A=()=>{g.value=!1},S=x=>()=>d(Ye,null,{default:()=>d(x)}),s=(x,P,F)=>({label:()=>d(st,{to:{name:P},onClick:A},{default:()=>x}),key:P,...F?{icon:S(F)}:{}}),T=C(()=>{const x=[s("工作台","dashboard",wr),s("备忘录","memos",gr)];return l.isLiteMode?x.push(s("二级库","warehouse-lite",qe)):x.push({label:"二级库",key:"warehouse-group",icon:S(qe),children:[s("库存查询","stock"),s("物资档案","stock-materials"),s("操作记录","operations"),...n.can("warehouse:write")?[s("入库","inbound"),s("出库","outbound")]:[]]}),x.push(s("华星总库存","hua-xing-stock",ar)),x.push({label:"申购管理",key:"procurement-group",icon:S(ur),children:[s("申购计划","purchase-materials"),s("周期性计划","purchase-plan-templates"),s("未编码物资","uncoded-materials"),s("物料编码库","material-code-library"),s("申购记录","purchase-records")]}),x.push({label:"隐患管理",key:"hazard-group",icon:S(Or),children:[s("隐患管理","hazard-records"),s("隐患类型","hazard-types"),s("责任单位","hazard-units")]}),x.push({label:"台账管理",key:"ledger-group",icon:S(yr),children:[s("台账总览","ledger-items"),s("标签管理","ledger-tags")]}),x.push({label:"工作管理",key:"work-group",icon:S(cr),children:[s("工作总览","work-overview"),s("任务视图","work-tasks"),s("人员视图","work-workers")]}),n.can("settings:write")&&x.push({label:"系统管理",key:"settings-group",icon:S(Mr),children:[s("管理端用户","users"),s("小程序用户","mini-program-users"),s("项目管理","projects"),s("附件管理","attachments"),s("高级设置","advanced-settings"),s("分享链接","share-links"),s("关于","about")]}),x});function E(){n.logout(),i.clear(),o.push({name:"login"})}const I=C(()=>[...Hr(v.mode,v.isDark,S),...Ur(i.enabledProjects,i.currentProject?.id??null,S),{type:"divider",key:"logout-divider"},{label:"退出登录",key:"logout",icon:S(zr)}]);function B(x){if(x==="logout"){E();return}if(Nr(x)){v.setMode(x);return}if(wo(x)){const P=Kr(x);P!==null&&i.select(P)}}return(x,P)=>{const F=ir,V=Gt,R=wt,h=gt,b=lo,N=Ut,k=lt("router-view"),L=Ft,O=Lt,X=At;return j(),K(no,null,[G(O,{"has-sider":!U(c),class:"app-shell"},{default:q(()=>[U(c)?oe("",!0):(j(),ce(V,{key:0,bordered:"","collapse-mode":"width","collapsed-width":64,width:180,collapsed:f.value,"show-trigger":"",onCollapse:P[0]||(P[0]=Y=>f.value=!0),onExpand:P[1]||(P[1]=Y=>f.value=!1)},{default:q(()=>[y("div",{class:tt(["brand",{compact:f.value}])},[y("img",{class:"brand-mark",src:U(We),alt:"系统 Logo"},null,8,Vr),f.value?oe("",!0):(j(),K("span",Wr,"HXNI 电气无忧"))],2),G(F,{collapsed:f.value,"collapsed-width":64,"collapsed-icon-size":22,options:T.value,value:String(U(t).name||"")},null,8,["collapsed","options","value"])]),_:1},8,["collapsed"])),G(O,null,{default:q(()=>[G(N,{bordered:"",class:"topbar"},{default:q(()=>[y("div",Yr,[U(c)?(j(),K("button",{key:0,type:"button",class:"menu-toggle","aria-label":"打开导航菜单",onClick:P[2]||(P[2]=Y=>g.value=!0)},[G(U(Ye),{size:20},{default:q(()=>[G(U(_r))]),_:1})])):oe("",!0),y("div",Xr,[G(h,null,{default:q(()=>[!U(c)&&U(t).meta.parent?(j(),ce(R,{key:0},{default:q(()=>[Ue(me(U(t).meta.parent),1)]),_:1})):oe("",!0),G(R,null,{default:q(()=>[Ue(me(U(t).meta.title),1)]),_:1})]),_:1})])]),y("div",Gr,[G(b,{options:I.value,onSelect:B},{default:q(()=>[y("button",qr,[y("span",Jr,[y("span",Qr,me(U(n).user?.display_name||U(n).user?.username),1),U(c)?oe("",!0):(j(),K("span",Zr,me(U(n).user?U(rt)[U(n).user.role]:""),1))]),P[4]||(P[4]=y("span",{class:"user-menu-caret","aria-hidden":"true"},null,-1))])]),_:1},8,["options"])])]),_:1}),G(L,{class:"app-content","native-scrollbar":!1},{default:q(()=>[G(k,null,{default:q(({Component:Y,route:Z})=>[(j(),ce(nt,null,[Z.meta.keepAlive?(j(),ce(Ve(Y),{key:String(Z.name)})):oe("",!0)],1024)),Z.meta.keepAlive?oe("",!0):(j(),ce(Ve(Y),{key:0}))]),_:1})]),_:1})]),_:1})]),_:1},8,["has-sider"]),G(X,{show:g.value,"onUpdate:show":P[3]||(P[3]=Y=>g.value=Y),placement:"left",width:250,"aria-label":"导航菜单"},{default:q(()=>[y("div",en,[y("img",{class:"brand-mark",src:U(We),alt:"系统 Logo"},null,8,on),P[5]||(P[5]=y("span",null,"HXNI 电气无忧",-1))]),G(F,{class:"drawer-menu",options:T.value,value:String(U(t).name||""),"onUpdate:value":A},null,8,["options","value"])]),_:1},8,["show"])],64)}}}),pn=mt(tn,[["__scopeId","data-v-c467bd04"]]);export{pn as default};
