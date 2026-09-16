import{n as p,m as e,ac as F,p as z,q as D,aI as G,aJ as H,d as E,aN as N,l as n,aO as q,s as J,t as L,v as K,y as j,aP as W,aL as T}from"./index-BDXvMQEj.js";import{g as Q}from"./get-slot-Bk_rJcZu.js";import{u as U}from"./use-compitable-Cp2lLBEn.js";function M(t,g="default",d=[]){const{children:s}=t;if(s!==null&&typeof s=="object"&&!Array.isArray(s)){const i=s[g];if(typeof i=="function")return i()}return d}const X=p([e("descriptions",{fontSize:"var(--n-font-size)"},[e("descriptions-separator",`
 display: inline-block;
 margin: 0 8px 0 2px;
 `),e("descriptions-table-wrapper",[e("descriptions-table",[e("descriptions-table-row",[e("descriptions-table-header",{padding:"var(--n-th-padding)"}),e("descriptions-table-content",{padding:"var(--n-td-padding)"})])])]),F("bordered",[e("descriptions-table-wrapper",[e("descriptions-table",[e("descriptions-table-row",[p("&:last-child",[e("descriptions-table-content",{paddingBottom:0})])])])])]),z("left-label-placement",[e("descriptions-table-content",[p("> *",{verticalAlign:"top"})])]),z("left-label-align",[p("th",{textAlign:"left"})]),z("center-label-align",[p("th",{textAlign:"center"})]),z("right-label-align",[p("th",{textAlign:"right"})]),z("bordered",[e("descriptions-table-wrapper",`
 border-radius: var(--n-border-radius);
 overflow: hidden;
 background: var(--n-merged-td-color);
 border: 1px solid var(--n-merged-border-color);
 `,[e("descriptions-table",[e("descriptions-table-row",[p("&:not(:last-child)",[e("descriptions-table-content",{borderBottom:"1px solid var(--n-merged-border-color)"}),e("descriptions-table-header",{borderBottom:"1px solid var(--n-merged-border-color)"})]),e("descriptions-table-header",`
 font-weight: 400;
 background-clip: padding-box;
 background-color: var(--n-merged-th-color);
 `,[p("&:not(:last-child)",{borderRight:"1px solid var(--n-merged-border-color)"})]),e("descriptions-table-content",[p("&:not(:last-child)",{borderRight:"1px solid var(--n-merged-border-color)"})])])])])]),e("descriptions-header",`
 font-weight: var(--n-th-font-weight);
 font-size: 18px;
 transition: color .3s var(--n-bezier);
 line-height: var(--n-line-height);
 margin-bottom: 16px;
 color: var(--n-title-text-color);
 `),e("descriptions-table-wrapper",`
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[e("descriptions-table",`
 width: 100%;
 border-collapse: separate;
 border-spacing: 0;
 box-sizing: border-box;
 `,[e("descriptions-table-row",`
 box-sizing: border-box;
 transition: border-color .3s var(--n-bezier);
 `,[e("descriptions-table-header",`
 font-weight: var(--n-th-font-weight);
 line-height: var(--n-line-height);
 display: table-cell;
 box-sizing: border-box;
 color: var(--n-th-text-color);
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `),e("descriptions-table-content",`
 vertical-align: top;
 line-height: var(--n-line-height);
 display: table-cell;
 box-sizing: border-box;
 color: var(--n-td-text-color);
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[D("content",`
 transition: color .3s var(--n-bezier);
 display: inline-block;
 color: var(--n-td-text-color);
 `)]),D("label",`
 font-weight: var(--n-th-font-weight);
 transition: color .3s var(--n-bezier);
 display: inline-block;
 margin-right: 14px;
 color: var(--n-th-text-color);
 `)])])])]),e("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color);
 --n-merged-td-color: var(--n-td-color);
 --n-merged-border-color: var(--n-border-color);
 `),G(e("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color-modal);
 --n-merged-td-color: var(--n-td-color-modal);
 --n-merged-border-color: var(--n-border-color-modal);
 `)),H(e("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color-popover);
 --n-merged-td-color: var(--n-td-color-popover);
 --n-merged-border-color: var(--n-border-color-popover);
 `))]),V="DESCRIPTION_ITEM_FLAG";function Y(t){return typeof t=="object"&&t&&!Array.isArray(t)?t.type&&t.type[V]:!1}const Z=Object.assign(Object.assign({},L.props),{title:String,column:{type:Number,default:3},columns:Number,labelPlacement:{type:String,default:"top"},labelAlign:{type:String,default:"left"},separator:{type:String,default:":"},size:String,bordered:Boolean,labelClass:String,labelStyle:[Object,String],contentClass:String,contentStyle:[Object,String]}),ne=E({name:"Descriptions",props:Z,slots:Object,setup(t){const{mergedClsPrefixRef:g,inlineThemeDisabled:d,mergedComponentPropsRef:s}=J(t),i=j(()=>{var l,a;return t.size||((a=(l=s?.value)===null||l===void 0?void 0:l.Descriptions)===null||a===void 0?void 0:a.size)||"medium"}),h=L("Descriptions","-descriptions",X,W,t,g),$=j(()=>{const{bordered:l}=t,a=i.value,{common:{cubicBezierEaseInOut:R},self:{titleTextColor:r,thColor:P,thColorModal:v,thColorPopover:_,thTextColor:A,thFontWeight:k,tdTextColor:I,tdColor:o,tdColorModal:f,tdColorPopover:O,borderColor:c,borderColorModal:m,borderColorPopover:y,borderRadius:w,lineHeight:u,[T("fontSize",a)]:S,[T(l?"thPaddingBordered":"thPadding",a)]:x,[T(l?"tdPaddingBordered":"tdPadding",a)]:C}}=h.value;return{"--n-title-text-color":r,"--n-th-padding":x,"--n-td-padding":C,"--n-font-size":S,"--n-bezier":R,"--n-th-font-weight":k,"--n-line-height":u,"--n-th-text-color":A,"--n-td-text-color":I,"--n-th-color":P,"--n-th-color-modal":v,"--n-th-color-popover":_,"--n-td-color":o,"--n-td-color-modal":f,"--n-td-color-popover":O,"--n-border-radius":w,"--n-border-color":c,"--n-border-color-modal":m,"--n-border-color-popover":y}}),b=d?K("descriptions",j(()=>{let l="";const{bordered:a}=t;return a&&(l+="a"),l+=i.value[0],l}),$,t):void 0;return{mergedClsPrefix:g,cssVars:d?void 0:$,themeClass:b?.themeClass,onRender:b?.onRender,compitableColumn:U(t,["columns","column"]),inlineThemeDisabled:d,mergedSize:i}},render(){const t=this.$slots.default,g=t?N(t()):[];g.length;const{contentClass:d,labelClass:s,compitableColumn:i,labelPlacement:h,labelAlign:$,mergedSize:b,bordered:l,title:a,cssVars:R,mergedClsPrefix:r,separator:P,onRender:v}=this;v?.();const _=g.filter(o=>Y(o)),A={span:0,row:[],secondRow:[],rows:[]},I=_.reduce((o,f,O)=>{const c=f.props||{},m=_.length-1===O,y=["label"in c?c.label:M(f,"label")],w=[M(f)],u=c.span||1,S=o.span;o.span+=u;const x=c.labelStyle||c["label-style"]||this.labelStyle,C=c.contentStyle||c["content-style"]||this.contentStyle;if(h==="left")l?o.row.push(n("th",{class:[`${r}-descriptions-table-header`,s],colspan:1,style:x},y),n("td",{class:[`${r}-descriptions-table-content`,d],colspan:m?(i-S)*2+1:u*2-1,style:C},w)):o.row.push(n("td",{class:`${r}-descriptions-table-content`,colspan:m?(i-S)*2:u*2},n("span",{class:[`${r}-descriptions-table-content__label`,s],style:x},[...y,P&&n("span",{class:`${r}-descriptions-separator`},P)]),n("span",{class:[`${r}-descriptions-table-content__content`,d],style:C},w)));else{const B=m?(i-S)*2:u*2;o.row.push(n("th",{class:[`${r}-descriptions-table-header`,s],colspan:B,style:x},y)),o.secondRow.push(n("td",{class:[`${r}-descriptions-table-content`,d],colspan:B,style:C},w))}return(o.span>=i||m)&&(o.span=0,o.row.length&&(o.rows.push(o.row),o.row=[]),h!=="left"&&o.secondRow.length&&(o.rows.push(o.secondRow),o.secondRow=[])),o},A).rows.map(o=>n("tr",{class:`${r}-descriptions-table-row`},o));return n("div",{style:R,class:[`${r}-descriptions`,this.themeClass,`${r}-descriptions--${h}-label-placement`,`${r}-descriptions--${$}-label-align`,`${r}-descriptions--${b}-size`,l&&`${r}-descriptions--bordered`]},a||this.$slots.header?n("div",{class:`${r}-descriptions-header`},a||Q(this,"header")):null,n("div",{class:`${r}-descriptions-table-wrapper`},n("table",{class:`${r}-descriptions-table`},n("tbody",null,h==="top"&&n("tr",{class:`${r}-descriptions-table-row`,style:{visibility:"collapse"}},q(i*2,n("td",null))),I))))}}),ee={label:String,span:{type:Number,default:1},labelClass:String,labelStyle:[Object,String],contentClass:String,contentStyle:[Object,String]},le=E({name:"DescriptionsItem",[V]:!0,props:ee,slots:Object,render(){return null}});export{le as _,ne as a};
