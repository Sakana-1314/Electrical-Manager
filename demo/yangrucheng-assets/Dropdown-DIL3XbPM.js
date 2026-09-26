import{B as Ne,b as Re,d as Pe,h as ie,r as ke,N as Ke,p as ae,c as Ce}from"./Popover-CMQDBUcJ.js";import{r as T,Q as se,d as z,n as d,C as re,ag as G,J as j,M as ue,T as Ie,ai as W,A as b,Y as ce,D as E,aj as _e,bI as Oe,bj as ze,Z as $e,X as De,p as x,bl as Ae,q as L,ae as de,s as k,t as O,ak as Fe,v as Te,x as pe,y as je,cp as Be,a6 as oe,E as K,aN as F}from"./index-DiWDHsV5.js";import{a as Me}from"./Icon-DiRVuw8a.js";import{u as Le}from"./get-Xt2e7D5F.js";import{u as Ee}from"./use-keyboard-CWAOrwvR.js";function He(e,r,a){const i=T(e.value);let t=null;return se(e,n=>{t!==null&&window.clearTimeout(t),n===!0?a&&!a.value?i.value=!0:t=window.setTimeout(()=>{i.value=!0},r):i.value=!1}),i}function Ue(e){return r=>{r?e.value=r.$el:e.value=null}}const qe=z({name:"ChevronRight",render(){return d("svg",{viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg"},d("path",{d:"M5.64645 3.14645C5.45118 3.34171 5.45118 3.65829 5.64645 3.85355L9.79289 8L5.64645 12.1464C5.45118 12.3417 5.45118 12.6583 5.64645 12.8536C5.84171 13.0488 6.15829 13.0488 6.35355 12.8536L10.8536 8.35355C11.0488 8.15829 11.0488 7.84171 10.8536 7.64645L6.35355 3.14645C6.15829 2.95118 5.84171 2.95118 5.64645 3.14645Z",fill:"currentColor"}))}}),te=re("n-dropdown-menu"),V=re("n-dropdown"),le=re("n-dropdown-option"),fe=z({name:"DropdownDivider",props:{clsPrefix:{type:String,required:!0}},render(){return d("div",{class:`${this.clsPrefix}-dropdown-divider`})}}),We=z({name:"DropdownGroupHeader",props:{clsPrefix:{type:String,required:!0},tmNode:{type:Object,required:!0}},setup(){const{showIconRef:e,hasSubmenuRef:r}=j(te),{renderLabelRef:a,labelFieldRef:i,nodePropsRef:t,renderOptionRef:n}=j(V);return{labelField:i,showIcon:e,hasSubmenu:r,renderLabel:a,nodeProps:t,renderOption:n}},render(){var e;const{clsPrefix:r,hasSubmenu:a,showIcon:i,nodeProps:t,renderLabel:n,renderOption:f}=this,{rawNode:v}=this.tmNode,p=d("div",Object.assign({class:`${r}-dropdown-option`},t?.(v)),d("div",{class:`${r}-dropdown-option-body ${r}-dropdown-option-body--group`},d("div",{"data-dropdown-option":!0,class:[`${r}-dropdown-option-body__prefix`,i&&`${r}-dropdown-option-body__prefix--show-icon`]},G(v.icon)),d("div",{class:`${r}-dropdown-option-body__label`,"data-dropdown-option":!0},n?n(v):G((e=v.title)!==null&&e!==void 0?e:v[this.labelField])),d("div",{class:[`${r}-dropdown-option-body__suffix`,a&&`${r}-dropdown-option-body__suffix--has-submenu`],"data-dropdown-option":!0})));return f?f({node:p,option:v}):p}});function ne(e,r){return e.type==="submenu"||e.type===void 0&&e[r]!==void 0}function Ge(e){return e.type==="group"}function ve(e){return e.type==="divider"}function Ve(e){return e.type==="render"}const he=z({name:"DropdownOption",props:{clsPrefix:{type:String,required:!0},tmNode:{type:Object,required:!0},parentKey:{type:[String,Number],default:null},placement:{type:String,default:"right-start"},props:Object,scrollable:Boolean},setup(e){const r=j(V),{hoverKeyRef:a,keyboardKeyRef:i,lastToggledSubmenuKeyRef:t,pendingKeyPathRef:n,activeKeyPathRef:f,animatedRef:v,mergedShowRef:p,renderLabelRef:y,renderIconRef:g,labelFieldRef:S,childrenFieldRef:C,renderOptionRef:N,nodePropsRef:R,menuPropsRef:$}=r,m=j(le,null),I=j(te),_=j(ce),U=b(()=>e.tmNode.rawNode),H=b(()=>{const{value:o}=C;return ne(e.tmNode.rawNode,o)}),X=b(()=>{const{disabled:o}=e.tmNode;return o}),Z=b(()=>{if(!H.value)return!1;const{key:o,disabled:u}=e.tmNode;if(u)return!1;const{value:w}=a,{value:D}=i,{value:ee}=t,{value:A}=n;return w!==null?A.includes(o):D!==null?A.includes(o)&&A[A.length-1]!==o:ee!==null?A.includes(o):!1}),J=b(()=>i.value===null&&!v.value),Q=He(Z,300,J),Y=b(()=>!!m?.enteringSubmenuRef.value),B=T(!1);E(le,{enteringSubmenuRef:B});function M(){B.value=!0}function q(){B.value=!1}function P(){const{parentKey:o,tmNode:u}=e;u.disabled||p.value&&(t.value=o,i.value=null,a.value=u.key)}function l(){const{tmNode:o}=e;o.disabled||p.value&&a.value!==o.key&&P()}function s(o){if(e.tmNode.disabled||!p.value)return;const{relatedTarget:u}=o;u&&!ie({target:u},"dropdownOption")&&!ie({target:u},"scrollbarRail")&&(a.value=null)}function c(){const{value:o}=H,{tmNode:u}=e;p.value&&!o&&!u.disabled&&(r.doSelect(u.key,u.rawNode),r.doUpdateShow(!1))}return{labelField:S,renderLabel:y,renderIcon:g,siblingHasIcon:I.showIconRef,siblingHasSubmenu:I.hasSubmenuRef,menuProps:$,popoverBody:_,animated:v,mergedShowSubmenu:b(()=>Q.value&&!Y.value),rawNode:U,hasSubmenu:H,pending:W(()=>{const{value:o}=n,{key:u}=e.tmNode;return o.includes(u)}),childActive:W(()=>{const{value:o}=f,{key:u}=e.tmNode,w=o.findIndex(D=>u===D);return w===-1?!1:w<o.length-1}),active:W(()=>{const{value:o}=f,{key:u}=e.tmNode,w=o.findIndex(D=>u===D);return w===-1?!1:w===o.length-1}),mergedDisabled:X,renderOption:N,nodeProps:R,handleClick:c,handleMouseMove:l,handleMouseEnter:P,handleMouseLeave:s,handleSubmenuBeforeEnter:M,handleSubmenuAfterEnter:q}},render(){var e,r;const{animated:a,rawNode:i,mergedShowSubmenu:t,clsPrefix:n,siblingHasIcon:f,siblingHasSubmenu:v,renderLabel:p,renderIcon:y,renderOption:g,nodeProps:S,props:C,scrollable:N}=this;let R=null;if(t){const _=(e=this.menuProps)===null||e===void 0?void 0:e.call(this,i,i.children);R=d(be,Object.assign({},_,{clsPrefix:n,scrollable:this.scrollable,tmNodes:this.tmNode.children,parentKey:this.tmNode.key}))}const $={class:[`${n}-dropdown-option-body`,this.pending&&`${n}-dropdown-option-body--pending`,this.active&&`${n}-dropdown-option-body--active`,this.childActive&&`${n}-dropdown-option-body--child-active`,this.mergedDisabled&&`${n}-dropdown-option-body--disabled`],onMousemove:this.handleMouseMove,onMouseenter:this.handleMouseEnter,onMouseleave:this.handleMouseLeave,onClick:this.handleClick},m=S?.(i),I=d("div",Object.assign({class:[`${n}-dropdown-option`,m?.class],"data-dropdown-option":!0},m),d("div",ue($,C),[d("div",{class:[`${n}-dropdown-option-body__prefix`,f&&`${n}-dropdown-option-body__prefix--show-icon`]},[y?y(i):G(i.icon)]),d("div",{"data-dropdown-option":!0,class:`${n}-dropdown-option-body__label`},p?p(i):G((r=i[this.labelField])!==null&&r!==void 0?r:i.title)),d("div",{"data-dropdown-option":!0,class:[`${n}-dropdown-option-body__suffix`,v&&`${n}-dropdown-option-body__suffix--has-submenu`]},this.hasSubmenu?d(Me,null,{default:()=>d(qe,null)}):null)]),this.hasSubmenu?d(Ne,null,{default:()=>[d(Re,null,{default:()=>d("div",{class:`${n}-dropdown-offset-container`},d(Pe,{show:this.mergedShowSubmenu,placement:this.placement,to:N&&this.popoverBody||void 0,teleportDisabled:!N},{default:()=>d("div",{class:`${n}-dropdown-menu-wrapper`},a?d(Ie,{onBeforeEnter:this.handleSubmenuBeforeEnter,onAfterEnter:this.handleSubmenuAfterEnter,name:"fade-in-scale-up-transition",appear:!0},{default:()=>R}):R)}))})]}):null);return g?g({node:I,option:i}):I}}),Xe=z({name:"NDropdownGroup",props:{clsPrefix:{type:String,required:!0},tmNode:{type:Object,required:!0},parentKey:{type:[String,Number],default:null}},render(){const{tmNode:e,parentKey:r,clsPrefix:a}=this,{children:i}=e;return d(_e,null,d(We,{clsPrefix:a,tmNode:e,key:e.key}),i?.map(t=>{const{rawNode:n}=t;return n.show===!1?null:ve(n)?d(fe,{clsPrefix:a,key:t.key}):t.isGroup?(Oe("dropdown","`group` node is not allowed to be put in `group` node."),null):d(he,{clsPrefix:a,tmNode:t,parentKey:r,key:t.key})}))}}),Ze=z({name:"DropdownRenderOption",props:{tmNode:{type:Object,required:!0}},render(){const{rawNode:{render:e,props:r}}=this.tmNode;return d("div",r,[e?.()])}}),be=z({name:"DropdownMenu",props:{scrollable:Boolean,showArrow:Boolean,arrowStyle:[String,Object],clsPrefix:{type:String,required:!0},tmNodes:{type:Array,default:()=>[]},parentKey:{type:[String,Number],default:null}},setup(e){const{renderIconRef:r,childrenFieldRef:a}=j(V);E(te,{showIconRef:b(()=>{const t=r.value;return e.tmNodes.some(n=>{var f;if(n.isGroup)return(f=n.children)===null||f===void 0?void 0:f.some(({rawNode:p})=>t?t(p):p.icon);const{rawNode:v}=n;return t?t(v):v.icon})}),hasSubmenuRef:b(()=>{const{value:t}=a;return e.tmNodes.some(n=>{var f;if(n.isGroup)return(f=n.children)===null||f===void 0?void 0:f.some(({rawNode:p})=>ne(p,t));const{rawNode:v}=n;return ne(v,t)})})});const i=T(null);return E($e,null),E(De,null),E(ce,i),{bodyRef:i}},render(){const{parentKey:e,clsPrefix:r,scrollable:a}=this,i=this.tmNodes.map(t=>{const{rawNode:n}=t;return n.show===!1?null:Ve(n)?d(Ze,{tmNode:t,key:t.key}):ve(n)?d(fe,{clsPrefix:r,key:t.key}):Ge(n)?d(Xe,{clsPrefix:r,tmNode:t,parentKey:e,key:t.key}):d(he,{clsPrefix:r,tmNode:t,parentKey:e,key:t.key,props:n.props,scrollable:a})});return d("div",{class:[`${r}-dropdown-menu`,a&&`${r}-dropdown-menu--scrollable`],ref:"bodyRef"},a?d(ze,{contentClass:`${r}-dropdown-menu__content`},{default:()=>i}):i,this.showArrow?ke({clsPrefix:r,arrowStyle:this.arrowStyle,arrowClass:void 0,arrowWrapperClass:void 0,arrowWrapperStyle:void 0}):null)}}),Je=x("dropdown-menu",`
 transform-origin: var(--v-transform-origin);
 background-color: var(--n-color);
 border-radius: var(--n-border-radius);
 box-shadow: var(--n-box-shadow);
 position: relative;
 transition:
 background-color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier);
`,[Ae(),x("dropdown-option",`
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
 `),de("disabled",[k("pending",`
 color: var(--n-option-text-color-hover);
 `,[O("prefix, suffix",`
 color: var(--n-option-text-color-hover);
 `),L("&::before","background-color: var(--n-option-color-hover);")]),k("active",`
 color: var(--n-option-text-color-active);
 `,[O("prefix, suffix",`
 color: var(--n-option-text-color-active);
 `),L("&::before","background-color: var(--n-option-color-active);")]),k("child-active",`
 color: var(--n-option-text-color-child-active);
 `,[O("prefix, suffix",`
 color: var(--n-option-text-color-child-active);
 `)])]),k("disabled",`
 cursor: not-allowed;
 opacity: var(--n-option-opacity-disabled);
 `),k("group",`
 font-size: calc(var(--n-font-size) - 1px);
 color: var(--n-group-header-text-color);
 `,[O("prefix",`
 width: calc(var(--n-option-prefix-width) / 2);
 `,[k("show-icon",`
 width: calc(var(--n-option-icon-prefix-width) / 2);
 `)])]),O("prefix",`
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
 `)]),O("label",`
 white-space: nowrap;
 flex: 1;
 z-index: 1;
 `),O("suffix",`
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
 `)]),de("scrollable",`
 padding: var(--n-padding);
 `),k("scrollable",[O("content",`
 padding: var(--n-padding);
 `)])]),Qe={animated:{type:Boolean,default:!0},keyboard:{type:Boolean,default:!0},size:String,inverted:Boolean,placement:{type:String,default:"bottom"},onSelect:[Function,Array],options:{type:Array,default:()=>[]},menuProps:Function,showArrow:Boolean,renderLabel:Function,renderIcon:Function,renderOption:Function,nodeProps:Function,labelField:{type:String,default:"label"},keyField:{type:String,default:"key"},childrenField:{type:String,default:"children"},value:[String,Number]},Ye=Object.keys(ae),eo=Object.assign(Object.assign(Object.assign({},ae),Qe),pe.props),lo=z({name:"Dropdown",inheritAttrs:!1,props:eo,setup(e){const r=T(!1),a=Le(K(e,"show"),r),i=b(()=>{const{keyField:l,childrenField:s}=e;return Ce(e.options,{getKey(c){return c[l]},getDisabled(c){return c.disabled===!0},getIgnored(c){return c.type==="divider"||c.type==="render"},getChildren(c){return c[s]}})}),t=b(()=>i.value.treeNodes),n=T(null),f=T(null),v=T(null),p=b(()=>{var l,s,c;return(c=(s=(l=n.value)!==null&&l!==void 0?l:f.value)!==null&&s!==void 0?s:v.value)!==null&&c!==void 0?c:null}),y=b(()=>i.value.getPath(p.value).keyPath),g=b(()=>i.value.getPath(e.value).keyPath),S=W(()=>e.keyboard&&a.value);Ee({keydown:{ArrowUp:{prevent:!0,handler:J},ArrowRight:{prevent:!0,handler:Z},ArrowDown:{prevent:!0,handler:Q},ArrowLeft:{prevent:!0,handler:X},Enter:{prevent:!0,handler:Y},Escape:H}},S);const{mergedClsPrefixRef:C,inlineThemeDisabled:N,mergedComponentPropsRef:R}=Te(e),$=b(()=>{var l,s;return e.size||((s=(l=R?.value)===null||l===void 0?void 0:l.Dropdown)===null||s===void 0?void 0:s.size)||"medium"}),m=pe("Dropdown","-dropdown",Je,Be,e,C);E(V,{labelFieldRef:K(e,"labelField"),childrenFieldRef:K(e,"childrenField"),renderLabelRef:K(e,"renderLabel"),renderIconRef:K(e,"renderIcon"),hoverKeyRef:n,keyboardKeyRef:f,lastToggledSubmenuKeyRef:v,pendingKeyPathRef:y,activeKeyPathRef:g,animatedRef:K(e,"animated"),mergedShowRef:a,nodePropsRef:K(e,"nodeProps"),renderOptionRef:K(e,"renderOption"),menuPropsRef:K(e,"menuProps"),doSelect:I,doUpdateShow:_}),se(a,l=>{!e.animated&&!l&&U()});function I(l,s){const{onSelect:c}=e;c&&oe(c,l,s)}function _(l){const{"onUpdate:show":s,onUpdateShow:c}=e;s&&oe(s,l),c&&oe(c,l),r.value=l}function U(){n.value=null,f.value=null,v.value=null}function H(){_(!1)}function X(){M("left")}function Z(){M("right")}function J(){M("up")}function Q(){M("down")}function Y(){const l=B();l?.isLeaf&&a.value&&(I(l.key,l.rawNode),_(!1))}function B(){var l;const{value:s}=i,{value:c}=p;return!s||c===null?null:(l=s.getNode(c))!==null&&l!==void 0?l:null}function M(l){const{value:s}=p,{value:{getFirstAvailableNode:c}}=i;let o=null;if(s===null){const u=c();u!==null&&(o=u.key)}else{const u=B();if(u){let w;switch(l){case"down":w=u.getNext();break;case"up":w=u.getPrev();break;case"right":w=u.getChild();break;case"left":w=u.getParent();break}w&&(o=w.key)}}o!==null&&(n.value=null,f.value=o)}const q=b(()=>{const{inverted:l}=e,s=$.value,{common:{cubicBezierEaseInOut:c},self:o}=m.value,{padding:u,dividerColor:w,borderRadius:D,optionOpacityDisabled:ee,[F("optionIconSuffixWidth",s)]:A,[F("optionSuffixWidth",s)]:we,[F("optionIconPrefixWidth",s)]:me,[F("optionPrefixWidth",s)]:ye,[F("fontSize",s)]:ge,[F("optionHeight",s)]:xe,[F("optionIconSize",s)]:Se}=o,h={"--n-bezier":c,"--n-font-size":ge,"--n-padding":u,"--n-border-radius":D,"--n-option-height":xe,"--n-option-prefix-width":ye,"--n-option-icon-prefix-width":me,"--n-option-suffix-width":we,"--n-option-icon-suffix-width":A,"--n-option-icon-size":Se,"--n-divider-color":w,"--n-option-opacity-disabled":ee};return l?(h["--n-color"]=o.colorInverted,h["--n-option-color-hover"]=o.optionColorHoverInverted,h["--n-option-color-active"]=o.optionColorActiveInverted,h["--n-option-text-color"]=o.optionTextColorInverted,h["--n-option-text-color-hover"]=o.optionTextColorHoverInverted,h["--n-option-text-color-active"]=o.optionTextColorActiveInverted,h["--n-option-text-color-child-active"]=o.optionTextColorChildActiveInverted,h["--n-prefix-color"]=o.prefixColorInverted,h["--n-suffix-color"]=o.suffixColorInverted,h["--n-group-header-text-color"]=o.groupHeaderTextColorInverted):(h["--n-color"]=o.color,h["--n-option-color-hover"]=o.optionColorHover,h["--n-option-color-active"]=o.optionColorActive,h["--n-option-text-color"]=o.optionTextColor,h["--n-option-text-color-hover"]=o.optionTextColorHover,h["--n-option-text-color-active"]=o.optionTextColorActive,h["--n-option-text-color-child-active"]=o.optionTextColorChildActive,h["--n-prefix-color"]=o.prefixColor,h["--n-suffix-color"]=o.suffixColor,h["--n-group-header-text-color"]=o.groupHeaderTextColor),h}),P=N?je("dropdown",b(()=>`${$.value[0]}${e.inverted?"i":""}`),q,e):void 0;return{mergedClsPrefix:C,mergedTheme:m,mergedSize:$,tmNodes:t,mergedShow:a,handleAfterLeave:()=>{e.animated&&U()},doUpdateShow:_,cssVars:N?void 0:q,themeClass:P?.themeClass,onRender:P?.onRender}},render(){const e=(i,t,n,f,v)=>{var p;const{mergedClsPrefix:y,menuProps:g}=this;(p=this.onRender)===null||p===void 0||p.call(this);const S=g?.(void 0,this.tmNodes.map(N=>N.rawNode))||{},C={ref:Ue(t),class:[i,`${y}-dropdown`,`${y}-dropdown--${this.mergedSize}-size`,this.themeClass],clsPrefix:y,tmNodes:this.tmNodes,style:[...n,this.cssVars],showArrow:this.showArrow,arrowStyle:this.arrowStyle,scrollable:this.scrollable,onMouseenter:f,onMouseleave:v};return d(be,ue(this.$attrs,C,S))},{mergedTheme:r}=this,a={show:this.mergedShow,theme:r.peers.Popover,themeOverrides:r.peerOverrides.Popover,internalOnAfterLeave:this.handleAfterLeave,internalRenderBody:e,onUpdateShow:this.doUpdateShow,"onUpdate:show":void 0};return d(Ke,Object.assign({},Fe(this.$props,Ye),a),{trigger:()=>{var i,t;return(t=(i=this.$slots).default)===null||t===void 0?void 0:t.call(i)}})}});export{qe as C,lo as N,Ue as c};
