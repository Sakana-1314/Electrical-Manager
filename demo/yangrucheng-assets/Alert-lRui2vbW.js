import{a8 as O,bT as F,a9 as u,bN as b,m as I,q as i,p as S,ad as V,n as N,d as K,l,aj as q,s as D,t as E,M as G,v as U,K as X,bU as Y,G as J,ba as Q,y as $,r as Z,ab as oo,bV as eo,bW as ro,bX as no,bY as so,bC as lo,aL as c}from"./index-BDXvMQEj.js";function to(r){const{lineHeight:o,borderRadius:d,fontWeightStrong:f,baseColor:t,dividerColor:v,actionColor:y,textColor1:g,textColor2:s,closeColorHover:h,closeColorPressed:C,closeIconColor:m,closeIconColorHover:p,closeIconColorPressed:n,infoColor:e,successColor:x,warningColor:z,errorColor:T,fontSize:P}=r;return Object.assign(Object.assign({},F),{fontSize:P,lineHeight:o,titleFontWeight:f,borderRadius:d,border:`1px solid ${v}`,color:y,titleTextColor:g,iconColor:s,contentTextColor:s,closeBorderRadius:d,closeColorHover:h,closeColorPressed:C,closeIconColor:m,closeIconColorHover:p,closeIconColorPressed:n,borderInfo:`1px solid ${u(t,b(e,{alpha:.25}))}`,colorInfo:u(t,b(e,{alpha:.08})),titleTextColorInfo:g,iconColorInfo:e,contentTextColorInfo:s,closeColorHoverInfo:h,closeColorPressedInfo:C,closeIconColorInfo:m,closeIconColorHoverInfo:p,closeIconColorPressedInfo:n,borderSuccess:`1px solid ${u(t,b(x,{alpha:.25}))}`,colorSuccess:u(t,b(x,{alpha:.08})),titleTextColorSuccess:g,iconColorSuccess:x,contentTextColorSuccess:s,closeColorHoverSuccess:h,closeColorPressedSuccess:C,closeIconColorSuccess:m,closeIconColorHoverSuccess:p,closeIconColorPressedSuccess:n,borderWarning:`1px solid ${u(t,b(z,{alpha:.33}))}`,colorWarning:u(t,b(z,{alpha:.08})),titleTextColorWarning:g,iconColorWarning:z,contentTextColorWarning:s,closeColorHoverWarning:h,closeColorPressedWarning:C,closeIconColorWarning:m,closeIconColorHoverWarning:p,closeIconColorPressedWarning:n,borderError:`1px solid ${u(t,b(T,{alpha:.25}))}`,colorError:u(t,b(T,{alpha:.08})),titleTextColorError:g,iconColorError:T,contentTextColorError:s,closeColorHoverError:h,closeColorPressedError:C,closeIconColorError:m,closeIconColorHoverError:p,closeIconColorPressedError:n})}const io={common:O,self:to},ao=I("alert",`
 line-height: var(--n-line-height);
 border-radius: var(--n-border-radius);
 position: relative;
 transition: background-color .3s var(--n-bezier);
 background-color: var(--n-color);
 text-align: start;
 word-break: break-word;
`,[i("border",`
 border-radius: inherit;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 transition: border-color .3s var(--n-bezier);
 border: var(--n-border);
 pointer-events: none;
 `),S("closable",[I("alert-body",[i("title",`
 padding-right: 24px;
 `)])]),i("icon",{color:"var(--n-icon-color)"}),I("alert-body",{padding:"var(--n-padding)"},[i("title",{color:"var(--n-title-text-color)"}),i("content",{color:"var(--n-content-text-color)"})]),V({originalTransition:"transform .3s var(--n-bezier)",enterToProps:{transform:"scale(1)"},leaveToProps:{transform:"scale(0.9)"}}),i("icon",`
 position: absolute;
 left: 0;
 top: 0;
 align-items: center;
 justify-content: center;
 display: flex;
 width: var(--n-icon-size);
 height: var(--n-icon-size);
 font-size: var(--n-icon-size);
 margin: var(--n-icon-margin);
 `),i("close",`
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 position: absolute;
 right: 0;
 top: 0;
 margin: var(--n-close-margin);
 `),S("show-icon",[I("alert-body",{paddingLeft:"calc(var(--n-icon-margin-left) + var(--n-icon-size) + var(--n-icon-margin-right))"})]),S("right-adjust",[I("alert-body",{paddingRight:"calc(var(--n-close-size) + var(--n-padding) + 2px)"})]),I("alert-body",`
 border-radius: var(--n-border-radius);
 transition: border-color .3s var(--n-bezier);
 `,[i("title",`
 transition: color .3s var(--n-bezier);
 font-size: 16px;
 line-height: 19px;
 font-weight: var(--n-title-font-weight);
 `,[N("& +",[i("content",{marginTop:"9px"})])]),i("content",{transition:"color .3s var(--n-bezier)",fontSize:"var(--n-font-size)"})]),i("icon",{transition:"color .3s var(--n-bezier)"})]),co=Object.assign(Object.assign({},E.props),{title:String,showIcon:{type:Boolean,default:!0},type:{type:String,default:"default"},bordered:{type:Boolean,default:!0},closable:Boolean,onClose:Function,onAfterLeave:Function,onAfterHide:Function}),ho=K({name:"Alert",inheritAttrs:!1,props:co,slots:Object,setup(r){const{mergedClsPrefixRef:o,mergedBorderedRef:d,inlineThemeDisabled:f,mergedRtlRef:t}=D(r),v=E("Alert","-alert",ao,io,r,o),y=G("Alert",t,o),g=$(()=>{const{common:{cubicBezierEaseInOut:n},self:e}=v.value,{fontSize:x,borderRadius:z,titleFontWeight:T,lineHeight:P,iconSize:H,iconMargin:R,iconMarginRtl:_,closeIconSize:W,closeBorderRadius:w,closeSize:A,closeMargin:B,closeMarginRtl:j,padding:L}=e,{type:a}=r,{left:k,right:M}=lo(R);return{"--n-bezier":n,"--n-color":e[c("color",a)],"--n-close-icon-size":W,"--n-close-border-radius":w,"--n-close-color-hover":e[c("closeColorHover",a)],"--n-close-color-pressed":e[c("closeColorPressed",a)],"--n-close-icon-color":e[c("closeIconColor",a)],"--n-close-icon-color-hover":e[c("closeIconColorHover",a)],"--n-close-icon-color-pressed":e[c("closeIconColorPressed",a)],"--n-icon-color":e[c("iconColor",a)],"--n-border":e[c("border",a)],"--n-title-text-color":e[c("titleTextColor",a)],"--n-content-text-color":e[c("contentTextColor",a)],"--n-line-height":P,"--n-border-radius":z,"--n-font-size":x,"--n-title-font-weight":T,"--n-icon-size":H,"--n-icon-margin":R,"--n-icon-margin-rtl":_,"--n-close-size":A,"--n-close-margin":B,"--n-close-margin-rtl":j,"--n-padding":L,"--n-icon-margin-left":k,"--n-icon-margin-right":M}}),s=f?U("alert",$(()=>r.type[0]),g,r):void 0,h=Z(!0),C=()=>{const{onAfterLeave:n,onAfterHide:e}=r;n&&n(),e&&e()};return{rtlEnabled:y,mergedClsPrefix:o,mergedBordered:d,visible:h,handleCloseClick:()=>{var n;Promise.resolve((n=r.onClose)===null||n===void 0?void 0:n.call(r)).then(e=>{e!==!1&&(h.value=!1)})},handleAfterLeave:()=>{C()},mergedTheme:v,cssVars:f?void 0:g,themeClass:s?.themeClass,onRender:s?.onRender}},render(){var r;return(r=this.onRender)===null||r===void 0||r.call(this),l(q,{onAfterLeave:this.handleAfterLeave},{default:()=>{const{mergedClsPrefix:o,$slots:d}=this,f={class:[`${o}-alert`,this.themeClass,this.closable&&`${o}-alert--closable`,this.showIcon&&`${o}-alert--show-icon`,!this.title&&this.closable&&`${o}-alert--right-adjust`,this.rtlEnabled&&`${o}-alert--rtl`],style:this.cssVars,role:"alert"};return this.visible?l("div",Object.assign({},X(this.$attrs,f)),this.closable&&l(Y,{clsPrefix:o,class:`${o}-alert__close`,onClick:this.handleCloseClick}),this.bordered&&l("div",{class:`${o}-alert__border`}),this.showIcon&&l("div",{class:`${o}-alert__icon`,"aria-hidden":"true"},J(d.icon,()=>[l(oo,{clsPrefix:o},{default:()=>{switch(this.type){case"success":return l(so,null);case"info":return l(no,null);case"warning":return l(ro,null);case"error":return l(eo,null);default:return null}}})])),l("div",{class:[`${o}-alert-body`,this.mergedBordered&&`${o}-alert-body--bordered`]},Q(d.header,t=>{const v=t||this.title;return v?l("div",{class:`${o}-alert-body__title`},v):null}),d.default&&l("div",{class:`${o}-alert-body__content`},d))):null}})}});export{ho as _};
