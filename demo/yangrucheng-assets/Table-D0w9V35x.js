import{q as r,p as i,s as n,ae as H,aK as K,aL as N,d as q,n as A,v as D,x as h,O as F,y as I,A as s,aM as W,aN as c}from"./index-DiWDHsV5.js";const G=r([i("table",`
 font-size: var(--n-font-size);
 font-variant-numeric: tabular-nums;
 line-height: var(--n-line-height);
 width: 100%;
 border-radius: var(--n-border-radius) var(--n-border-radius) 0 0;
 text-align: left;
 border-collapse: separate;
 border-spacing: 0;
 overflow: hidden;
 background-color: var(--n-td-color);
 border-color: var(--n-merged-border-color);
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 --n-merged-border-color: var(--n-border-color);
 `,[r("th",`
 white-space: nowrap;
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 text-align: inherit;
 padding: var(--n-th-padding);
 vertical-align: inherit;
 text-transform: none;
 border: 0px solid var(--n-merged-border-color);
 font-weight: var(--n-th-font-weight);
 color: var(--n-th-text-color);
 background-color: var(--n-th-color);
 border-bottom: 1px solid var(--n-merged-border-color);
 border-right: 1px solid var(--n-merged-border-color);
 `,[r("&:last-child",`
 border-right: 0px solid var(--n-merged-border-color);
 `)]),r("td",`
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 padding: var(--n-td-padding);
 color: var(--n-td-text-color);
 background-color: var(--n-td-color);
 border: 0px solid var(--n-merged-border-color);
 border-right: 1px solid var(--n-merged-border-color);
 border-bottom: 1px solid var(--n-merged-border-color);
 `,[r("&:last-child",`
 border-right: 0px solid var(--n-merged-border-color);
 `)]),n("bordered",`
 border: 1px solid var(--n-merged-border-color);
 border-radius: var(--n-border-radius);
 `,[r("tr",[r("&:last-child",[r("td",`
 border-bottom: 0 solid var(--n-merged-border-color);
 `)])])]),n("single-line",[r("th",`
 border-right: 0px solid var(--n-merged-border-color);
 `),r("td",`
 border-right: 0px solid var(--n-merged-border-color);
 `)]),n("single-column",[r("tr",[r("&:not(:last-child)",[r("td",`
 border-bottom: 0px solid var(--n-merged-border-color);
 `)])])]),n("striped",[r("tr:nth-of-type(even)",[r("td","background-color: var(--n-td-color-striped)")])]),H("bottom-bordered",[r("tr",[r("&:last-child",[r("td",`
 border-bottom: 0px solid var(--n-merged-border-color);
 `)])])])]),K(i("table",`
 background-color: var(--n-td-color-modal);
 --n-merged-border-color: var(--n-border-color-modal);
 `,[r("th",`
 background-color: var(--n-th-color-modal);
 `),r("td",`
 background-color: var(--n-td-color-modal);
 `)])),N(i("table",`
 background-color: var(--n-td-color-popover);
 --n-merged-border-color: var(--n-border-color-popover);
 `,[r("th",`
 background-color: var(--n-th-color-popover);
 `),r("td",`
 background-color: var(--n-td-color-popover);
 `)]))]),J=Object.assign(Object.assign({},h.props),{bordered:{type:Boolean,default:!0},bottomBordered:{type:Boolean,default:!0},singleLine:{type:Boolean,default:!0},striped:Boolean,singleColumn:Boolean,size:String}),U=q({name:"Table",props:J,setup(e){const{mergedClsPrefixRef:o,inlineThemeDisabled:b,mergedRtlRef:p,mergedComponentPropsRef:a}=D(e),v=s(()=>{var d,l;return e.size||((l=(d=a?.value)===null||d===void 0?void 0:d.Table)===null||l===void 0?void 0:l.size)||"medium"}),m=h("Table","-table",G,W,e,o),u=F("Table",p,o),g=s(()=>{const d=v.value,{self:{borderColor:l,tdColor:f,tdColorModal:x,tdColorPopover:C,thColor:z,thColorModal:P,thColorPopover:k,thTextColor:R,tdTextColor:B,borderRadius:T,thFontWeight:y,lineHeight:M,borderColorModal:_,borderColorPopover:$,tdColorStriped:w,tdColorStripedModal:S,tdColorStripedPopover:E,[c("fontSize",d)]:L,[c("tdPadding",d)]:O,[c("thPadding",d)]:V},common:{cubicBezierEaseInOut:j}}=m.value;return{"--n-bezier":j,"--n-td-color":f,"--n-td-color-modal":x,"--n-td-color-popover":C,"--n-td-text-color":B,"--n-border-color":l,"--n-border-color-modal":_,"--n-border-color-popover":$,"--n-border-radius":T,"--n-font-size":L,"--n-th-color":z,"--n-th-color-modal":P,"--n-th-color-popover":k,"--n-th-font-weight":y,"--n-th-text-color":R,"--n-line-height":M,"--n-td-padding":O,"--n-th-padding":V,"--n-td-color-striped":w,"--n-td-color-striped-modal":S,"--n-td-color-striped-popover":E}}),t=b?I("table",s(()=>v.value[0]),g,e):void 0;return{rtlEnabled:u,mergedClsPrefix:o,cssVars:b?void 0:g,themeClass:t?.themeClass,onRender:t?.onRender}},render(){var e;const{mergedClsPrefix:o}=this;return(e=this.onRender)===null||e===void 0||e.call(this),A("table",{class:[`${o}-table`,this.themeClass,{[`${o}-table--rtl`]:this.rtlEnabled,[`${o}-table--bottom-bordered`]:this.bottomBordered,[`${o}-table--bordered`]:this.bordered,[`${o}-table--single-line`]:this.singleLine,[`${o}-table--single-column`]:this.singleColumn,[`${o}-table--striped`]:this.striped}],style:this.cssVars},this.$slots)}});export{U as _};
