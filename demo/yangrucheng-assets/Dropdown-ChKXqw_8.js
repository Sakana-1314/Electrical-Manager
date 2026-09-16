import{B as Ne,V as Re,a as Pe,r as ke,N as Ke,p as ae}from"./Popover-0APPIHAn.js";import{r as F,O as se,z as re,d as j,l,ae as G,H as T,K as ue,T as Ie,ag as q,y as b,W as ce,A as E,ah as Ce,bi as Oe,bD as _e,X as ze,V as $e,m as x,bd as De,n as L,ac as ie,p as k,q as _,ai as Ae,s as Fe,t as pe,v as Te,ce as je,a4 as oe,C as K,aL as A}from"./index-BDXvMQEj.js";import{N as Be}from"./Icon-CQw4xd8O.js";import{C as Me}from"./ChevronRight-B5umcNMq.js";import{h as de,c as Le}from"./create-Bg_XWjCL.js";import{u as Ee}from"./get-KC8MG7tb.js";import{u as He}from"./use-keyboard-Ca1IjecK.js";function Ue(e,r,a){const i=F(e.value);let t=null;return se(e,n=>{t!==null&&window.clearTimeout(t),n===!0?a&&!a.value?i.value=!0:t=window.setTimeout(()=>{i.value=!0},r):i.value=!1}),i}function We(e){return r=>{r?e.value=r.$el:e.value=null}}const te=re("n-dropdown-menu"),V=re("n-dropdown"),le=re("n-dropdown-option"),fe=j({name:"DropdownDivider",props:{clsPrefix:{type:String,required:!0}},render(){return l("div",{class:`${this.clsPrefix}-dropdown-divider`})}}),qe=j({name:"DropdownGroupHeader",props:{clsPrefix:{type:String,required:!0},tmNode:{type:Object,required:!0}},setup(){const{showIconRef:e,hasSubmenuRef:r}=T(te),{renderLabelRef:a,labelFieldRef:i,nodePropsRef:t,renderOptionRef:n}=T(V);return{labelField:i,showIcon:e,hasSubmenu:r,renderLabel:a,nodeProps:t,renderOption:n}},render(){var e;const{clsPrefix:r,hasSubmenu:a,showIcon:i,nodeProps:t,renderLabel:n,renderOption:f}=this,{rawNode:v}=this.tmNode,p=l("div",Object.assign({class:`${r}-dropdown-option`},t?.(v)),l("div",{class:`${r}-dropdown-option-body ${r}-dropdown-option-body--group`},l("div",{"data-dropdown-option":!0,class:[`${r}-dropdown-option-body__prefix`,i&&`${r}-dropdown-option-body__prefix--show-icon`]},G(v.icon)),l("div",{class:`${r}-dropdown-option-body__label`,"data-dropdown-option":!0},n?n(v):G((e=v.title)!==null&&e!==void 0?e:v[this.labelField])),l("div",{class:[`${r}-dropdown-option-body__suffix`,a&&`${r}-dropdown-option-body__suffix--has-submenu`],"data-dropdown-option":!0})));return f?f({node:p,option:v}):p}});function ne(e,r){return e.type==="submenu"||e.type===void 0&&e[r]!==void 0}function Ge(e){return e.type==="group"}function ve(e){return e.type==="divider"}function Ve(e){return e.type==="render"}const he=j({name:"DropdownOption",props:{clsPrefix:{type:String,required:!0},tmNode:{type:Object,required:!0},parentKey:{type:[String,Number],default:null},placement:{type:String,default:"right-start"},props:Object,scrollable:Boolean},setup(e){const r=T(V),{hoverKeyRef:a,keyboardKeyRef:i,lastToggledSubmenuKeyRef:t,pendingKeyPathRef:n,activeKeyPathRef:f,animatedRef:v,mergedShowRef:p,renderLabelRef:y,renderIconRef:g,labelFieldRef:S,childrenFieldRef:I,renderOptionRef:N,nodePropsRef:R,menuPropsRef:z}=r,m=T(le,null),C=T(te),O=T(ce),U=b(()=>e.tmNode.rawNode),H=b(()=>{const{value:o}=I;return ne(e.tmNode.rawNode,o)}),X=b(()=>{const{disabled:o}=e.tmNode;return o}),J=b(()=>{if(!H.value)return!1;const{key:o,disabled:u}=e.tmNode;if(u)return!1;const{value:w}=a,{value:$}=i,{value:ee}=t,{value:D}=n;return w!==null?D.includes(o):$!==null?D.includes(o)&&D[D.length-1]!==o:ee!==null?D.includes(o):!1}),Q=b(()=>i.value===null&&!v.value),Y=Ue(J,300,Q),Z=b(()=>!!m?.enteringSubmenuRef.value),B=F(!1);E(le,{enteringSubmenuRef:B});function M(){B.value=!0}function W(){B.value=!1}function P(){const{parentKey:o,tmNode:u}=e;u.disabled||p.value&&(t.value=o,i.value=null,a.value=u.key)}function d(){const{tmNode:o}=e;o.disabled||p.value&&a.value!==o.key&&P()}function s(o){if(e.tmNode.disabled||!p.value)return;const{relatedTarget:u}=o;u&&!de({target:u},"dropdownOption")&&!de({target:u},"scrollbarRail")&&(a.value=null)}function c(){const{value:o}=H,{tmNode:u}=e;p.value&&!o&&!u.disabled&&(r.doSelect(u.key,u.rawNode),r.doUpdateShow(!1))}return{labelField:S,renderLabel:y,renderIcon:g,siblingHasIcon:C.showIconRef,siblingHasSubmenu:C.hasSubmenuRef,menuProps:z,popoverBody:O,animated:v,mergedShowSubmenu:b(()=>Y.value&&!Z.value),rawNode:U,hasSubmenu:H,pending:q(()=>{const{value:o}=n,{key:u}=e.tmNode;return o.includes(u)}),childActive:q(()=>{const{value:o}=f,{key:u}=e.tmNode,w=o.findIndex($=>u===$);return w===-1?!1:w<o.length-1}),active:q(()=>{const{value:o}=f,{key:u}=e.tmNode,w=o.findIndex($=>u===$);return w===-1?!1:w===o.length-1}),mergedDisabled:X,renderOption:N,nodeProps:R,handleClick:c,handleMouseMove:d,handleMouseEnter:P,handleMouseLeave:s,handleSubmenuBeforeEnter:M,handleSubmenuAfterEnter:W}},render(){var e,r;const{animated:a,rawNode:i,mergedShowSubmenu:t,clsPrefix:n,siblingHasIcon:f,siblingHasSubmenu:v,renderLabel:p,renderIcon:y,renderOption:g,nodeProps:S,props:I,scrollable:N}=this;let R=null;if(t){const O=(e=this.menuProps)===null||e===void 0?void 0:e.call(this,i,i.children);R=l(be,Object.assign({},O,{clsPrefix:n,scrollable:this.scrollable,tmNodes:this.tmNode.children,parentKey:this.tmNode.key}))}const z={class:[`${n}-dropdown-option-body`,this.pending&&`${n}-dropdown-option-body--pending`,this.active&&`${n}-dropdown-option-body--active`,this.childActive&&`${n}-dropdown-option-body--child-active`,this.mergedDisabled&&`${n}-dropdown-option-body--disabled`],onMousemove:this.handleMouseMove,onMouseenter:this.handleMouseEnter,onMouseleave:this.handleMouseLeave,onClick:this.handleClick},m=S?.(i),C=l("div",Object.assign({class:[`${n}-dropdown-option`,m?.class],"data-dropdown-option":!0},m),l("div",ue(z,I),[l("div",{class:[`${n}-dropdown-option-body__prefix`,f&&`${n}-dropdown-option-body__prefix--show-icon`]},[y?y(i):G(i.icon)]),l("div",{"data-dropdown-option":!0,class:`${n}-dropdown-option-body__label`},p?p(i):G((r=i[this.labelField])!==null&&r!==void 0?r:i.title)),l("div",{"data-dropdown-option":!0,class:[`${n}-dropdown-option-body__suffix`,v&&`${n}-dropdown-option-body__suffix--has-submenu`]},this.hasSubmenu?l(Be,null,{default:()=>l(Me,null)}):null)]),this.hasSubmenu?l(Ne,null,{default:()=>[l(Re,null,{default:()=>l("div",{class:`${n}-dropdown-offset-container`},l(Pe,{show:this.mergedShowSubmenu,placement:this.placement,to:N&&this.popoverBody||void 0,teleportDisabled:!N},{default:()=>l("div",{class:`${n}-dropdown-menu-wrapper`},a?l(Ie,{onBeforeEnter:this.handleSubmenuBeforeEnter,onAfterEnter:this.handleSubmenuAfterEnter,name:"fade-in-scale-up-transition",appear:!0},{default:()=>R}):R)}))})]}):null);return g?g({node:C,option:i}):C}}),Xe=j({name:"NDropdownGroup",props:{clsPrefix:{type:String,required:!0},tmNode:{type:Object,required:!0},parentKey:{type:[String,Number],default:null}},render(){const{tmNode:e,parentKey:r,clsPrefix:a}=this,{children:i}=e;return l(Ce,null,l(qe,{clsPrefix:a,tmNode:e,key:e.key}),i?.map(t=>{const{rawNode:n}=t;return n.show===!1?null:ve(n)?l(fe,{clsPrefix:a,key:t.key}):t.isGroup?(Oe("dropdown","`group` node is not allowed to be put in `group` node."),null):l(he,{clsPrefix:a,tmNode:t,parentKey:r,key:t.key})}))}}),Je=j({name:"DropdownRenderOption",props:{tmNode:{type:Object,required:!0}},render(){const{rawNode:{render:e,props:r}}=this.tmNode;return l("div",r,[e?.()])}}),be=j({name:"DropdownMenu",props:{scrollable:Boolean,showArrow:Boolean,arrowStyle:[String,Object],clsPrefix:{type:String,required:!0},tmNodes:{type:Array,default:()=>[]},parentKey:{type:[String,Number],default:null}},setup(e){const{renderIconRef:r,childrenFieldRef:a}=T(V);E(te,{showIconRef:b(()=>{const t=r.value;return e.tmNodes.some(n=>{var f;if(n.isGroup)return(f=n.children)===null||f===void 0?void 0:f.some(({rawNode:p})=>t?t(p):p.icon);const{rawNode:v}=n;return t?t(v):v.icon})}),hasSubmenuRef:b(()=>{const{value:t}=a;return e.tmNodes.some(n=>{var f;if(n.isGroup)return(f=n.children)===null||f===void 0?void 0:f.some(({rawNode:p})=>ne(p,t));const{rawNode:v}=n;return ne(v,t)})})});const i=F(null);return E(ze,null),E($e,null),E(ce,i),{bodyRef:i}},render(){const{parentKey:e,clsPrefix:r,scrollable:a}=this,i=this.tmNodes.map(t=>{const{rawNode:n}=t;return n.show===!1?null:Ve(n)?l(Je,{tmNode:t,key:t.key}):ve(n)?l(fe,{clsPrefix:r,key:t.key}):Ge(n)?l(Xe,{clsPrefix:r,tmNode:t,parentKey:e,key:t.key}):l(he,{clsPrefix:r,tmNode:t,parentKey:e,key:t.key,props:n.props,scrollable:a})});return l("div",{class:[`${r}-dropdown-menu`,a&&`${r}-dropdown-menu--scrollable`],ref:"bodyRef"},a?l(_e,{contentClass:`${r}-dropdown-menu__content`},{default:()=>i}):i,this.showArrow?ke({clsPrefix:r,arrowStyle:this.arrowStyle,arrowClass:void 0,arrowWrapperClass:void 0,arrowWrapperStyle:void 0}):null)}}),Qe=x("dropdown-menu",`
 transform-origin: var(--v-transform-origin);
 background-color: var(--n-color);
 border-radius: var(--n-border-radius);
 box-shadow: var(--n-box-shadow);
 position: relative;
 transition:
 background-color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier);
`,[De(),x("dropdown-option",`
 position: relative;
 `,[L("a",`
 text-decoration: none;
 color: inherit;
 outline: none;
 `,[L("&::before",`
 content: "";
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),x("dropdown-option-body",`
 display: flex;
 cursor: pointer;
 position: relative;
 height: var(--n-option-height);
 line-height: var(--n-option-height);
 font-size: var(--n-font-size);
 color: var(--n-option-text-color);
 transition: color .3s var(--n-bezier);
 `,[L("&::before",`
 content: "";
 position: absolute;
 top: 0;
 bottom: 0;
 left: 4px;
 right: 4px;
 transition: background-color .3s var(--n-bezier);
 border-radius: var(--n-border-radius);
 `),ie("disabled",[k("pending",`
 color: var(--n-option-text-color-hover);
 `,[_("prefix, suffix",`
 color: var(--n-option-text-color-hover);
 `),L("&::before","background-color: var(--n-option-color-hover);")]),k("active",`
 color: var(--n-option-text-color-active);
 `,[_("prefix, suffix",`
 color: var(--n-option-text-color-active);
 `),L("&::before","background-color: var(--n-option-color-active);")]),k("child-active",`
 color: var(--n-option-text-color-child-active);
 `,[_("prefix, suffix",`
 color: var(--n-option-text-color-child-active);
 `)])]),k("disabled",`
 cursor: not-allowed;
 opacity: var(--n-option-opacity-disabled);
 `),k("group",`
 font-size: calc(var(--n-font-size) - 1px);
 color: var(--n-group-header-text-color);
 `,[_("prefix",`
 width: calc(var(--n-option-prefix-width) / 2);
 `,[k("show-icon",`
 width: calc(var(--n-option-icon-prefix-width) / 2);
 `)])]),_("prefix",`
 width: var(--n-option-prefix-width);
 display: flex;
 justify-content: center;
 align-items: center;
 color: var(--n-prefix-color);
 transition: color .3s var(--n-bezier);
 z-index: 1;
 `,[k("show-icon",`
 width: var(--n-option-icon-prefix-width);
 `),x("icon",`
 font-size: var(--n-option-icon-size);
 `)]),_("label",`
 white-space: nowrap;
 flex: 1;
 z-index: 1;
 `),_("suffix",`
 box-sizing: border-box;
 flex-grow: 0;
 flex-shrink: 0;
 display: flex;
 justify-content: flex-end;
 align-items: center;
 min-width: var(--n-option-suffix-width);
 padding: 0 8px;
 transition: color .3s var(--n-bezier);
 color: var(--n-suffix-color);
 z-index: 1;
 `,[k("has-submenu",`
 width: var(--n-option-icon-suffix-width);
 `),x("icon",`
 font-size: var(--n-option-icon-size);
 `)]),x("dropdown-menu","pointer-events: all;")]),x("dropdown-offset-container",`
 pointer-events: none;
 position: absolute;
 left: 0;
 right: 0;
 top: -4px;
 bottom: -4px;
 `)]),x("dropdown-divider",`
 transition: background-color .3s var(--n-bezier);
 background-color: var(--n-divider-color);
 height: 1px;
 margin: 4px 0;
 `),x("dropdown-menu-wrapper",`
 transform-origin: var(--v-transform-origin);
 width: fit-content;
 `),L(">",[x("scrollbar",`
 height: inherit;
 max-height: inherit;
 `)]),ie("scrollable",`
 padding: var(--n-padding);
 `),k("scrollable",[_("content",`
 padding: var(--n-padding);
 `)])]),Ye={animated:{type:Boolean,default:!0},keyboard:{type:Boolean,default:!0},size:String,inverted:Boolean,placement:{type:String,default:"bottom"},onSelect:[Function,Array],options:{type:Array,default:()=>[]},menuProps:Function,showArrow:Boolean,renderLabel:Function,renderIcon:Function,renderOption:Function,nodeProps:Function,labelField:{type:String,default:"label"},keyField:{type:String,default:"key"},childrenField:{type:String,default:"children"},value:[String,Number]},Ze=Object.keys(ae),eo=Object.assign(Object.assign(Object.assign({},ae),Ye),pe.props),so=j({name:"Dropdown",inheritAttrs:!1,props:eo,setup(e){const r=F(!1),a=Ee(K(e,"show"),r),i=b(()=>{const{keyField:d,childrenField:s}=e;return Le(e.options,{getKey(c){return c[d]},getDisabled(c){return c.disabled===!0},getIgnored(c){return c.type==="divider"||c.type==="render"},getChildren(c){return c[s]}})}),t=b(()=>i.value.treeNodes),n=F(null),f=F(null),v=F(null),p=b(()=>{var d,s,c;return(c=(s=(d=n.value)!==null&&d!==void 0?d:f.value)!==null&&s!==void 0?s:v.value)!==null&&c!==void 0?c:null}),y=b(()=>i.value.getPath(p.value).keyPath),g=b(()=>i.value.getPath(e.value).keyPath),S=q(()=>e.keyboard&&a.value);He({keydown:{ArrowUp:{prevent:!0,handler:Q},ArrowRight:{prevent:!0,handler:J},ArrowDown:{prevent:!0,handler:Y},ArrowLeft:{prevent:!0,handler:X},Enter:{prevent:!0,handler:Z},Escape:H}},S);const{mergedClsPrefixRef:I,inlineThemeDisabled:N,mergedComponentPropsRef:R}=Fe(e),z=b(()=>{var d,s;return e.size||((s=(d=R?.value)===null||d===void 0?void 0:d.Dropdown)===null||s===void 0?void 0:s.size)||"medium"}),m=pe("Dropdown","-dropdown",Qe,je,e,I);E(V,{labelFieldRef:K(e,"labelField"),childrenFieldRef:K(e,"childrenField"),renderLabelRef:K(e,"renderLabel"),renderIconRef:K(e,"renderIcon"),hoverKeyRef:n,keyboardKeyRef:f,lastToggledSubmenuKeyRef:v,pendingKeyPathRef:y,activeKeyPathRef:g,animatedRef:K(e,"animated"),mergedShowRef:a,nodePropsRef:K(e,"nodeProps"),renderOptionRef:K(e,"renderOption"),menuPropsRef:K(e,"menuProps"),doSelect:C,doUpdateShow:O}),se(a,d=>{!e.animated&&!d&&U()});function C(d,s){const{onSelect:c}=e;c&&oe(c,d,s)}function O(d){const{"onUpdate:show":s,onUpdateShow:c}=e;s&&oe(s,d),c&&oe(c,d),r.value=d}function U(){n.value=null,f.value=null,v.value=null}function H(){O(!1)}function X(){M("left")}function J(){M("right")}function Q(){M("up")}function Y(){M("down")}function Z(){const d=B();d?.isLeaf&&a.value&&(C(d.key,d.rawNode),O(!1))}function B(){var d;const{value:s}=i,{value:c}=p;return!s||c===null?null:(d=s.getNode(c))!==null&&d!==void 0?d:null}function M(d){const{value:s}=p,{value:{getFirstAvailableNode:c}}=i;let o=null;if(s===null){const u=c();u!==null&&(o=u.key)}else{const u=B();if(u){let w;switch(d){case"down":w=u.getNext();break;case"up":w=u.getPrev();break;case"right":w=u.getChild();break;case"left":w=u.getParent();break}w&&(o=w.key)}}o!==null&&(n.value=null,f.value=o)}const W=b(()=>{const{inverted:d}=e,s=z.value,{common:{cubicBezierEaseInOut:c},self:o}=m.value,{padding:u,dividerColor:w,borderRadius:$,optionOpacityDisabled:ee,[A("optionIconSuffixWidth",s)]:D,[A("optionSuffixWidth",s)]:we,[A("optionIconPrefixWidth",s)]:me,[A("optionPrefixWidth",s)]:ye,[A("fontSize",s)]:ge,[A("optionHeight",s)]:xe,[A("optionIconSize",s)]:Se}=o,h={"--n-bezier":c,"--n-font-size":ge,"--n-padding":u,"--n-border-radius":$,"--n-option-height":xe,"--n-option-prefix-width":ye,"--n-option-icon-prefix-width":me,"--n-option-suffix-width":we,"--n-option-icon-suffix-width":D,"--n-option-icon-size":Se,"--n-divider-color":w,"--n-option-opacity-disabled":ee};return d?(h["--n-color"]=o.colorInverted,h["--n-option-color-hover"]=o.optionColorHoverInverted,h["--n-option-color-active"]=o.optionColorActiveInverted,h["--n-option-text-color"]=o.optionTextColorInverted,h["--n-option-text-color-hover"]=o.optionTextColorHoverInverted,h["--n-option-text-color-active"]=o.optionTextColorActiveInverted,h["--n-option-text-color-child-active"]=o.optionTextColorChildActiveInverted,h["--n-prefix-color"]=o.prefixColorInverted,h["--n-suffix-color"]=o.suffixColorInverted,h["--n-group-header-text-color"]=o.groupHeaderTextColorInverted):(h["--n-color"]=o.color,h["--n-option-color-hover"]=o.optionColorHover,h["--n-option-color-active"]=o.optionColorActive,h["--n-option-text-color"]=o.optionTextColor,h["--n-option-text-color-hover"]=o.optionTextColorHover,h["--n-option-text-color-active"]=o.optionTextColorActive,h["--n-option-text-color-child-active"]=o.optionTextColorChildActive,h["--n-prefix-color"]=o.prefixColor,h["--n-suffix-color"]=o.suffixColor,h["--n-group-header-text-color"]=o.groupHeaderTextColor),h}),P=N?Te("dropdown",b(()=>`${z.value[0]}${e.inverted?"i":""}`),W,e):void 0;return{mergedClsPrefix:I,mergedTheme:m,mergedSize:z,tmNodes:t,mergedShow:a,handleAfterLeave:()=>{e.animated&&U()},doUpdateShow:O,cssVars:N?void 0:W,themeClass:P?.themeClass,onRender:P?.onRender}},render(){const e=(i,t,n,f,v)=>{var p;const{mergedClsPrefix:y,menuProps:g}=this;(p=this.onRender)===null||p===void 0||p.call(this);const S=g?.(void 0,this.tmNodes.map(N=>N.rawNode))||{},I={ref:We(t),class:[i,`${y}-dropdown`,`${y}-dropdown--${this.mergedSize}-size`,this.themeClass],clsPrefix:y,tmNodes:this.tmNodes,style:[...n,this.cssVars],showArrow:this.showArrow,arrowStyle:this.arrowStyle,scrollable:this.scrollable,onMouseenter:f,onMouseleave:v};return l(be,ue(this.$attrs,I,S))},{mergedTheme:r}=this,a={show:this.mergedShow,theme:r.peers.Popover,themeOverrides:r.peerOverrides.Popover,internalOnAfterLeave:this.handleAfterLeave,internalRenderBody:e,onUpdateShow:this.doUpdateShow,"onUpdate:show":void 0};return l(Ke,Object.assign({},Ae(this.$props,Ze),a),{trigger:()=>{var i,t;return(t=(i=this.$slots).default)===null||t===void 0?void 0:t.call(i)}})}});export{so as N,We as c};
