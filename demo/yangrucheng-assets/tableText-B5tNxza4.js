import{e as f,f as x,h as s,g as P,Y as W,j as O,m as D,n as k,A as j,p as V,c as q,w as I,a1 as K,am as Q,an as A,ao as Y,a2 as Z,$ as G,t as J,N as X}from"./index-DdpJiXO9.js";import{u as ee}from"./get-CbyS0LBV.js";import{c as re}from"./light-Cyeg187q.js";import{j as S,k as l,r as te,c as N,p as ae,B as oe,t as B,D as ne,i as le}from"./vendor-vue-vqiuIG17.js";import{h as T}from"./Popover-D01XT1UV.js";import{C as ie}from"./Dropdown-B4LSvJX2.js";import{N as se}from"./Tag-B78NPiBP.js";const de=S({name:"ChevronLeft",render(){return l("svg",{viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg"},l("path",{d:"M10.3536 3.14645C10.5488 3.34171 10.5488 3.65829 10.3536 3.85355L6.20711 8L10.3536 12.1464C10.5488 12.3417 10.5488 12.6583 10.3536 12.8536C10.1583 13.0488 9.84171 13.0488 9.64645 12.8536L5.14645 8.35355C4.95118 8.15829 4.95118 7.84171 5.14645 7.64645L9.64645 3.14645C9.84171 2.95118 10.1583 2.95118 10.3536 3.14645Z",fill:"currentColor"}))}}),ce=f("collapse","width: 100%;",[f("collapse-item",`
 font-size: var(--n-font-size);
 color: var(--n-text-color);
 transition:
 color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 margin: var(--n-item-margin);
 `,[x("disabled",[s("header","cursor: not-allowed;",[s("header-main",`
 color: var(--n-title-text-color-disabled);
 `),f("collapse-item-arrow",`
 color: var(--n-arrow-color-disabled);
 `)])]),f("collapse-item","margin-left: 32px;"),P("&:first-child","margin-top: 0;"),P("&:first-child >",[s("header","padding-top: 0;")]),x("left-arrow-placement",[s("header",[f("collapse-item-arrow","margin-right: 4px;")])]),x("right-arrow-placement",[s("header",[f("collapse-item-arrow","margin-left: 4px;")])]),s("content-wrapper",[s("content-inner","padding-top: 16px;"),W({duration:"0.15s"})]),x("active",[s("header",[x("active",[f("collapse-item-arrow","transform: rotate(90deg);")])])]),P("&:not(:first-child)","border-top: 1px solid var(--n-divider-color);"),O("disabled",[x("trigger-area-main",[s("header",[s("header-main","cursor: pointer;"),f("collapse-item-arrow","cursor: default;")])]),x("trigger-area-arrow",[s("header",[f("collapse-item-arrow","cursor: pointer;")])]),x("trigger-area-extra",[s("header",[s("header-extra","cursor: pointer;")])])]),s("header",`
 font-size: var(--n-title-font-size);
 display: flex;
 flex-wrap: nowrap;
 align-items: center;
 transition: color .3s var(--n-bezier);
 position: relative;
 padding: var(--n-title-padding);
 color: var(--n-title-text-color);
 `,[s("header-main",`
 display: flex;
 flex-wrap: nowrap;
 align-items: center;
 font-weight: var(--n-title-font-weight);
 transition: color .3s var(--n-bezier);
 flex: 1;
 color: var(--n-title-text-color);
 `),s("header-extra",`
 display: flex;
 align-items: center;
 transition: color .3s var(--n-bezier);
 color: var(--n-text-color);
 `),f("collapse-item-arrow",`
 display: flex;
 transition:
 transform .15s var(--n-bezier),
 color .3s var(--n-bezier);
 font-size: 18px;
 color: var(--n-arrow-color);
 `)])])]),pe=Object.assign(Object.assign({},k.props),{defaultExpandedNames:{type:[Array,String],default:null},expandedNames:[Array,String],arrowPlacement:{type:String,default:"left"},accordion:{type:Boolean,default:!1},displayDirective:{type:String,default:"if"},triggerAreas:{type:Array,default:()=>["main","extra","arrow"]},onItemHeaderClick:[Function,Array],"onUpdate:expandedNames":[Function,Array],onUpdateExpandedNames:[Function,Array],onExpandedNamesChange:{type:[Function,Array],validator:()=>!0,default:void 0}}),F=q("n-collapse"),ye=S({name:"Collapse",props:pe,slots:Object,setup(e,{slots:i}){const{mergedClsPrefixRef:a,inlineThemeDisabled:o,mergedRtlRef:d}=D(e),t=te(e.defaultExpandedNames),h=N(()=>e.expandedNames),v=ee(h,t),w=k("Collapse","-collapse",ce,re,e,a);function c(p){const{"onUpdate:expandedNames":n,onUpdateExpandedNames:m,onExpandedNamesChange:b}=e;m&&I(m,p),n&&I(n,p),b&&I(b,p),t.value=p}function g(p){const{onItemHeaderClick:n}=e;n&&I(n,p)}function r(p,n,m){const{accordion:b}=e,{value:E}=v;if(b)p?(c([n]),g({name:n,expanded:!0,event:m})):(c([]),g({name:n,expanded:!1,event:m}));else if(!Array.isArray(E))c([n]),g({name:n,expanded:!0,event:m});else{const C=E.slice(),_=C.findIndex($=>n===$);~_?(C.splice(_,1),c(C),g({name:n,expanded:!1,event:m})):(C.push(n),c(C),g({name:n,expanded:!0,event:m}))}}ae(F,{props:e,mergedClsPrefixRef:a,expandedNamesRef:v,slots:i,toggleItem:r});const u=j("Collapse",d,a),R=N(()=>{const{common:{cubicBezierEaseInOut:p},self:{titleFontWeight:n,dividerColor:m,titlePadding:b,titleTextColor:E,titleTextColorDisabled:C,textColor:_,arrowColor:$,fontSize:L,titleFontSize:U,arrowColorDisabled:M,itemMargin:H}}=w.value;return{"--n-font-size":L,"--n-bezier":p,"--n-text-color":_,"--n-divider-color":m,"--n-title-padding":b,"--n-title-font-size":U,"--n-title-text-color":E,"--n-title-text-color-disabled":C,"--n-title-font-weight":n,"--n-arrow-color":$,"--n-arrow-color-disabled":M,"--n-item-margin":H}}),y=o?V("collapse",void 0,R,e):void 0;return{rtlEnabled:u,mergedTheme:w,mergedClsPrefix:a,cssVars:o?void 0:R,themeClass:y?.themeClass,onRender:y?.onRender}},render(){var e;return(e=this.onRender)===null||e===void 0||e.call(this),l("div",{class:[`${this.mergedClsPrefix}-collapse`,this.rtlEnabled&&`${this.mergedClsPrefix}-collapse--rtl`,this.themeClass],style:this.cssVars},this.$slots)}}),me=S({name:"CollapseItemContent",props:{displayDirective:{type:String,required:!0},show:Boolean,clsPrefix:{type:String,required:!0}},setup(e){return{onceTrue:Q(B(e,"show"))}},render(){return l(K,null,{default:()=>{const{show:e,displayDirective:i,onceTrue:a,clsPrefix:o}=this,d=i==="show"&&a,t=l("div",{class:`${o}-collapse-item__content-wrapper`},l("div",{class:`${o}-collapse-item__content-inner`},this.$slots));return d?oe(t,[[ne,e]]):e?t:null}})}}),fe={title:String,name:[String,Number],disabled:Boolean,displayDirective:String},be=S({name:"CollapseItem",props:fe,setup(e){const{mergedRtlRef:i}=D(e),a=Z(),o=G(()=>{var r;return(r=e.name)!==null&&r!==void 0?r:a}),d=le(F);d||J("collapse-item","`n-collapse-item` must be placed inside `n-collapse`.");const{expandedNamesRef:t,props:h,mergedClsPrefixRef:v,slots:w}=d,c=N(()=>{const{value:r}=t;if(Array.isArray(r)){const{value:u}=o;return!~r.findIndex(R=>R===u)}else if(r){const{value:u}=o;return u!==r}return!0});return{rtlEnabled:j("Collapse",i,v),collapseSlots:w,randomName:a,mergedClsPrefix:v,collapsed:c,triggerAreas:B(h,"triggerAreas"),mergedDisplayDirective:N(()=>{const{displayDirective:r}=e;return r||h.displayDirective}),arrowPlacement:N(()=>h.arrowPlacement),handleClick(r){let u="main";T(r,"arrow")&&(u="arrow"),T(r,"extra")&&(u="extra"),h.triggerAreas.includes(u)&&d&&!e.disabled&&d.toggleItem(c.value,o.value,r)}}},render(){const{collapseSlots:e,$slots:i,arrowPlacement:a,collapsed:o,mergedDisplayDirective:d,mergedClsPrefix:t,disabled:h,triggerAreas:v}=this,w=A(i.header,{collapsed:o},()=>[this.title]),c=i["header-extra"]||e["header-extra"],g=i.arrow||e.arrow;return l("div",{class:[`${t}-collapse-item`,`${t}-collapse-item--${a}-arrow-placement`,h&&`${t}-collapse-item--disabled`,!o&&`${t}-collapse-item--active`,v.map(r=>`${t}-collapse-item--trigger-area-${r}`)]},l("div",{class:[`${t}-collapse-item__header`,!o&&`${t}-collapse-item__header--active`]},l("div",{class:`${t}-collapse-item__header-main`,onClick:this.handleClick},a==="right"&&w,l("div",{class:`${t}-collapse-item-arrow`,key:this.rtlEnabled?0:1,"data-arrow":!0},A(g,{collapsed:o},()=>[l(X,{clsPrefix:t},{default:()=>this.rtlEnabled?l(de,null):l(ie,null)})])),a==="left"&&w),Y(c,{collapsed:o},r=>l("div",{class:`${t}-collapse-item__header-extra`,onClick:this.handleClick,"data-extra":!0},r))),l(me,{clsPrefix:t,displayDirective:d,show:!o},i))}});function z(e,i="\\"){const a=e==null||e===""?i:String(e);return l("div",{class:"table-text-two-line",title:a===i?void 0:a},a)}function Ne(e){return e?z(e):l(se,{type:"warning",size:"small"},{default:()=>"暂无编码"})}function Re(e,i,a="\\"){const o=e==null||e===""?"":String(e);if(!o)return z(null,a);const d=`${o}${i??""}`;return z(d)}export{ye as _,z as a,Re as b,be as c,Ne as r};
