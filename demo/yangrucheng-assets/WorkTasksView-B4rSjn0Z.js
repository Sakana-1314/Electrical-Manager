import{j as ae,k as o,c as I,aj as It,q as _t,r as V,w as Be,b as Dt,x as Re,t as Pt,S as we,U as S,L as s,Q as te,W as v,$ as H,h as re,a2 as Ie,R as _e,F as Nt,G as Mt,d as Vt,a4 as Ft,a1 as jt,ab as Ue}from"./vendor-vue-BcMl6tRj.js";import{_ as Wt,a as Ot}from"./PersistentDataTable.vue_vue_type_script_setup_true_lang-CXOBZhGS.js";import{I as Ut,N as Je,aE as Ze,aF as et,aG as tt,aH as rt,aI as At,n as Q,q as i,t as N,f as ot,y as ke,A as De,a9 as Ae,v as ve,aA as Ee,ac as Et,ad as Ht,az as qt,aB as Gt,x as Lt,E as me,aJ as be,aK as ye,ab as ie,Z as Xt,B as oe,u as Kt,_ as He}from"./index-CnuJBKRN.js";import{C as Yt}from"./ColumnVisibilityPicker-MucKqS6A.js";import{I as Qt}from"./ImageThumbnails-blf8QEW0.js";import{I as Jt}from"./ImageUploader-PreGuYqv.js";import{a as qe,d as Ge}from"./time-C-h7-CII.js";import{B as Zt,b as er,d as tr,u as Pe}from"./Popover-p3SnkF9O.js";import{u as rr}from"./get-DsD_x2cB.js";import{s as or,p as ar}from"./_common-YfBtOP-T.js";import{u as nr}from"./use-message-DyK1Wwb6.js";import{u as lr}from"./composables-yIzM3OJ9.js";import{N as ir,a as K}from"./Grid-CbujjHWy.js";import{a as Y,_ as sr}from"./FormItem-B8BxG2b-.js";import{_ as de}from"./Input-opkA_inf.js";import{N as Le}from"./DatePicker-N-ngdDv0.js";import{N as dr}from"./InputNumber-Da8zsp1W.js";import{_ as Ne}from"./Select-COCD1z9P.js";import{_ as at}from"./_plugin-vue_export-helper-DlAUqK2U.js";import{t as Te,p as ur,g as cr}from"./table-DErZD7ZQ.js";import{u as fr}from"./usePagedTable-Dpu26VuD.js";import{c as gr}from"./tableRowNavigation-D1nTqGi5.js";import{f as se}from"./format-length-B-p6aW7q.js";import{N as pr}from"./Tag-CnSPMa-o.js";import"./Checkbox-ChEXve8f.js";import"./light-CzL9ajGW.js";import"./light-CyQ2kNYo.js";import"./light-w6l29Lfu.js";import"./light-aa0_xnGc.js";import"./light-C8uoskwS.js";import"./light-ntmZTVLN.js";import"./light-CzSkgg-G.js";import"./light-DvfP9rFz.js";import"./Tooltip-DtSvDB7L.js";import"./Dropdown-DNS3G4ax.js";import"./Icon-pB8kN9le.js";import"./light-B9F2kUra.js";import"./use-keyboard-Dv9k_gPf.js";import"./get-slot-Bk_rJcZu.js";import"./Empty-Box0eCui.js";import"./use-locale-DbmYz_I2.js";import"./Forward-BWaYNpPW.js";import"./image-Bn7hDYwS.js";import"./files-DRboXXk8.js";import"./use-compitable-CE4Atwgp.js";import"./light-B8Glldh4.js";import"./light-Ba9xT6kc.js";import"./Add-C4dbFC2j.js";import"./_common-5fSvgue4.js";function hr(e){const n="rgba(0, 0, 0, .85)",g="0 2px 8px 0 rgba(0, 0, 0, 0.12)",{railColor:w,primaryColor:d,baseColor:u,cardColor:c,modalColor:h,popoverColor:z,borderRadius:R,fontSize:$,opacityDisabled:T}=e;return Object.assign(Object.assign({},or),{fontSize:$,markFontSize:$,railColor:w,railColorHover:w,fillColor:d,fillColorHover:d,opacityDisabled:T,handleColor:"#FFF",dotColor:c,dotColorModal:h,dotColorPopover:z,handleBoxShadow:"0 1px 4px 0 rgba(0, 0, 0, 0.3), inset 0 0 1px 0 rgba(0, 0, 0, 0.05)",handleBoxShadowHover:"0 1px 4px 0 rgba(0, 0, 0, 0.3), inset 0 0 1px 0 rgba(0, 0, 0, 0.05)",handleBoxShadowActive:"0 1px 4px 0 rgba(0, 0, 0, 0.3), inset 0 0 1px 0 rgba(0, 0, 0, 0.05)",handleBoxShadowFocus:"0 1px 4px 0 rgba(0, 0, 0, 0.3), inset 0 0 1px 0 rgba(0, 0, 0, 0.05)",indicatorColor:n,indicatorBoxShadow:g,indicatorTextColor:u,indicatorBorderRadius:R,dotBorder:`2px solid ${w}`,dotBorderActive:`2px solid ${d}`,dotBoxShadow:""})}const vr={common:Ut,self:hr},mr={success:o(rt,null),error:o(tt,null),warning:o(et,null),info:o(Ze,null)},br=ae({name:"ProgressCircle",props:{clsPrefix:{type:String,required:!0},status:{type:String,required:!0},strokeWidth:{type:Number,required:!0},fillColor:[String,Object],railColor:String,railStyle:[String,Object],percentage:{type:Number,default:0},offsetDegree:{type:Number,default:0},showIndicator:{type:Boolean,required:!0},indicatorTextColor:String,unit:String,viewBoxWidth:{type:Number,required:!0},gapDegree:{type:Number,required:!0},gapOffsetDegree:{type:Number,default:0}},setup(e,{slots:n}){const g=I(()=>{const u="gradient",{fillColor:c}=e;return typeof c=="object"?`${u}-${At(JSON.stringify(c))}`:u});function w(u,c,h,z){const{gapDegree:R,viewBoxWidth:$,strokeWidth:T}=e,p=50,P=0,k=p,a=0,O=2*p,_=50+T/2,M=`M ${_},${_} m ${P},${k}
      a ${p},${p} 0 1 1 ${a},${-O}
      a ${p},${p} 0 1 1 ${-a},${O}`,U=Math.PI*2*p,j={stroke:z==="rail"?h:typeof e.fillColor=="object"?`url(#${g.value})`:h,strokeDasharray:`${Math.min(u,100)/100*(U-R)}px ${$*8}px`,strokeDashoffset:`-${R/2}px`,transformOrigin:c?"center":void 0,transform:c?`rotate(${c}deg)`:void 0};return{pathString:M,pathStyle:j}}const d=()=>{const u=typeof e.fillColor=="object",c=u?e.fillColor.stops[0]:"",h=u?e.fillColor.stops[1]:"";return u&&o("defs",null,o("linearGradient",{id:g.value,x1:"0%",y1:"100%",x2:"100%",y2:"0%"},o("stop",{offset:"0%","stop-color":c}),o("stop",{offset:"100%","stop-color":h})))};return()=>{const{fillColor:u,railColor:c,strokeWidth:h,offsetDegree:z,status:R,percentage:$,showIndicator:T,indicatorTextColor:p,unit:P,gapOffsetDegree:k,clsPrefix:a}=e,{pathString:O,pathStyle:_}=w(100,0,c,"rail"),{pathString:M,pathStyle:U}=w($,z,u,"fill"),j=100+h;return o("div",{class:`${a}-progress-content`,role:"none"},o("div",{class:`${a}-progress-graph`,"aria-hidden":!0},o("div",{class:`${a}-progress-graph-circle`,style:{transform:k?`rotate(${k}deg)`:void 0}},o("svg",{viewBox:`0 0 ${j} ${j}`},d(),o("g",null,o("path",{class:`${a}-progress-graph-circle-rail`,d:O,"stroke-width":h,"stroke-linecap":"round",fill:"none",style:_})),o("g",null,o("path",{class:[`${a}-progress-graph-circle-fill`,$===0&&`${a}-progress-graph-circle-fill--empty`],d:M,"stroke-width":h,"stroke-linecap":"round",fill:"none",style:U}))))),T?o("div",null,n.default?o("div",{class:`${a}-progress-custom-content`,role:"none"},n.default()):R!=="default"?o("div",{class:`${a}-progress-icon`,"aria-hidden":!0},o(Je,{clsPrefix:a},{default:()=>mr[R]})):o("div",{class:`${a}-progress-text`,style:{color:p},role:"none"},o("span",{class:`${a}-progress-text__percentage`},$),o("span",{class:`${a}-progress-text__unit`},P))):null)}}}),yr={success:o(rt,null),error:o(tt,null),warning:o(et,null),info:o(Ze,null)},wr=ae({name:"ProgressLine",props:{clsPrefix:{type:String,required:!0},percentage:{type:Number,default:0},railColor:String,railStyle:[String,Object],fillColor:[String,Object],status:{type:String,required:!0},indicatorPlacement:{type:String,required:!0},indicatorTextColor:String,unit:{type:String,default:"%"},processing:{type:Boolean,required:!0},showIndicator:{type:Boolean,required:!0},height:[String,Number],railBorderRadius:[String,Number],fillBorderRadius:[String,Number]},setup(e,{slots:n}){const g=I(()=>se(e.height)),w=I(()=>{var c,h;return typeof e.fillColor=="object"?`linear-gradient(to right, ${(c=e.fillColor)===null||c===void 0?void 0:c.stops[0]} , ${(h=e.fillColor)===null||h===void 0?void 0:h.stops[1]})`:e.fillColor}),d=I(()=>e.railBorderRadius!==void 0?se(e.railBorderRadius):e.height!==void 0?se(e.height,{c:.5}):""),u=I(()=>e.fillBorderRadius!==void 0?se(e.fillBorderRadius):e.railBorderRadius!==void 0?se(e.railBorderRadius):e.height!==void 0?se(e.height,{c:.5}):"");return()=>{const{indicatorPlacement:c,railColor:h,railStyle:z,percentage:R,unit:$,indicatorTextColor:T,status:p,showIndicator:P,processing:k,clsPrefix:a}=e;return o("div",{class:`${a}-progress-content`,role:"none"},o("div",{class:`${a}-progress-graph`,"aria-hidden":!0},o("div",{class:[`${a}-progress-graph-line`,{[`${a}-progress-graph-line--indicator-${c}`]:!0}]},o("div",{class:`${a}-progress-graph-line-rail`,style:[{backgroundColor:h,height:g.value,borderRadius:d.value},z]},o("div",{class:[`${a}-progress-graph-line-fill`,k&&`${a}-progress-graph-line-fill--processing`],style:{maxWidth:`${e.percentage}%`,background:w.value,height:g.value,lineHeight:g.value,borderRadius:u.value}},c==="inside"?o("div",{class:`${a}-progress-graph-line-indicator`,style:{color:T}},n.default?n.default():`${R}${$}`):null)))),P&&c==="outside"?o("div",null,n.default?o("div",{class:`${a}-progress-custom-content`,style:{color:T},role:"none"},n.default()):p==="default"?o("div",{role:"none",class:`${a}-progress-icon ${a}-progress-icon--as-text`,style:{color:T}},R,$):o("div",{class:`${a}-progress-icon`,"aria-hidden":!0},o(Je,{clsPrefix:a},{default:()=>yr[p]}))):null)}}});function Xe(e,n,g=100){return`m ${g/2} ${g/2-e} a ${e} ${e} 0 1 1 0 ${2*e} a ${e} ${e} 0 1 1 0 -${2*e}`}const kr=ae({name:"ProgressMultipleCircle",props:{clsPrefix:{type:String,required:!0},viewBoxWidth:{type:Number,required:!0},percentage:{type:Array,default:[0]},strokeWidth:{type:Number,required:!0},circleGap:{type:Number,required:!0},showIndicator:{type:Boolean,required:!0},fillColor:{type:Array,default:()=>[]},railColor:{type:Array,default:()=>[]},railStyle:{type:Array,default:()=>[]}},setup(e,{slots:n}){const g=I(()=>e.percentage.map((u,c)=>`${Math.PI*u/100*(e.viewBoxWidth/2-e.strokeWidth/2*(1+2*c)-e.circleGap*c)*2}, ${e.viewBoxWidth*8}`)),w=(d,u)=>{const c=e.fillColor[u],h=typeof c=="object"?c.stops[0]:"",z=typeof c=="object"?c.stops[1]:"";return typeof e.fillColor[u]=="object"&&o("linearGradient",{id:`gradient-${u}`,x1:"100%",y1:"0%",x2:"0%",y2:"100%"},o("stop",{offset:"0%","stop-color":h}),o("stop",{offset:"100%","stop-color":z}))};return()=>{const{viewBoxWidth:d,strokeWidth:u,circleGap:c,showIndicator:h,fillColor:z,railColor:R,railStyle:$,percentage:T,clsPrefix:p}=e;return o("div",{class:`${p}-progress-content`,role:"none"},o("div",{class:`${p}-progress-graph`,"aria-hidden":!0},o("div",{class:`${p}-progress-graph-circle`},o("svg",{viewBox:`0 0 ${d} ${d}`},o("defs",null,T.map((P,k)=>w(P,k))),T.map((P,k)=>o("g",{key:k},o("path",{class:`${p}-progress-graph-circle-rail`,d:Xe(d/2-u/2*(1+2*k)-c*k,u,d),"stroke-width":u,"stroke-linecap":"round",fill:"none",style:[{strokeDashoffset:0,stroke:R[k]},$[k]]}),o("path",{class:[`${p}-progress-graph-circle-fill`,P===0&&`${p}-progress-graph-circle-fill--empty`],d:Xe(d/2-u/2*(1+2*k)-c*k,u,d),"stroke-width":u,"stroke-linecap":"round",fill:"none",style:{strokeDasharray:g.value[k],strokeDashoffset:0,stroke:typeof z[k]=="object"?`url(#gradient-${k})`:z[k]}})))))),h&&n.default?o("div",null,o("div",{class:`${p}-progress-text`},n.default())):null)}}}),xr=Q([i("progress",{display:"inline-block"},[i("progress-icon",`
 color: var(--n-icon-color);
 transition: color .3s var(--n-bezier);
 `),N("line",`
 width: 100%;
 display: block;
 `,[i("progress-content",`
 display: flex;
 align-items: center;
 `,[i("progress-graph",{flex:1})]),i("progress-custom-content",{marginLeft:"14px"}),i("progress-icon",`
 width: 30px;
 padding-left: 14px;
 height: var(--n-icon-size-line);
 line-height: var(--n-icon-size-line);
 font-size: var(--n-icon-size-line);
 `,[N("as-text",`
 color: var(--n-text-color-line-outer);
 text-align: center;
 width: 40px;
 font-size: var(--n-font-size);
 padding-left: 4px;
 transition: color .3s var(--n-bezier);
 `)])]),N("circle, dashboard",{width:"120px"},[i("progress-custom-content",`
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 justify-content: center;
 `),i("progress-text",`
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 color: inherit;
 font-size: var(--n-font-size-circle);
 color: var(--n-text-color-circle);
 font-weight: var(--n-font-weight-circle);
 transition: color .3s var(--n-bezier);
 white-space: nowrap;
 `),i("progress-icon",`
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 color: var(--n-icon-color);
 font-size: var(--n-icon-size-circle);
 `)]),N("multiple-circle",`
 width: 200px;
 color: inherit;
 `,[i("progress-text",`
 font-weight: var(--n-font-weight-circle);
 color: var(--n-text-color-circle);
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 justify-content: center;
 transition: color .3s var(--n-bezier);
 `)]),i("progress-content",{position:"relative"}),i("progress-graph",{position:"relative"},[i("progress-graph-circle",[Q("svg",{verticalAlign:"bottom"}),i("progress-graph-circle-fill",`
 stroke: var(--n-fill-color);
 transition:
 opacity .3s var(--n-bezier),
 stroke .3s var(--n-bezier),
 stroke-dasharray .3s var(--n-bezier);
 `,[N("empty",{opacity:0})]),i("progress-graph-circle-rail",`
 transition: stroke .3s var(--n-bezier);
 overflow: hidden;
 stroke: var(--n-rail-color);
 `)]),i("progress-graph-line",[N("indicator-inside",[i("progress-graph-line-rail",`
 height: 16px;
 line-height: 16px;
 border-radius: 10px;
 `,[i("progress-graph-line-fill",`
 height: inherit;
 border-radius: 10px;
 `),i("progress-graph-line-indicator",`
 background: #0000;
 white-space: nowrap;
 text-align: right;
 margin-left: 14px;
 margin-right: 14px;
 height: inherit;
 font-size: 12px;
 color: var(--n-text-color-line-inner);
 transition: color .3s var(--n-bezier);
 `)])]),N("indicator-inside-label",`
 height: 16px;
 display: flex;
 align-items: center;
 `,[i("progress-graph-line-rail",`
 flex: 1;
 transition: background-color .3s var(--n-bezier);
 `),i("progress-graph-line-indicator",`
 background: var(--n-fill-color);
 font-size: 12px;
 transform: translateZ(0);
 display: flex;
 vertical-align: middle;
 height: 16px;
 line-height: 16px;
 padding: 0 10px;
 border-radius: 10px;
 position: absolute;
 white-space: nowrap;
 color: var(--n-text-color-line-inner);
 transition:
 right .2s var(--n-bezier),
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 `)]),i("progress-graph-line-rail",`
 position: relative;
 overflow: hidden;
 height: var(--n-rail-height);
 border-radius: 5px;
 background-color: var(--n-rail-color);
 transition: background-color .3s var(--n-bezier);
 `,[i("progress-graph-line-fill",`
 background: var(--n-fill-color);
 position: relative;
 border-radius: 5px;
 height: inherit;
 width: 100%;
 max-width: 0%;
 transition:
 background-color .3s var(--n-bezier),
 max-width .2s var(--n-bezier);
 `,[N("processing",[Q("&::after",`
 content: "";
 background-image: var(--n-line-bg-processing);
 animation: progress-processing-animation 2s var(--n-bezier) infinite;
 `)])])])])])]),Q("@keyframes progress-processing-animation",`
 0% {
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 right: 100%;
 opacity: 1;
 }
 66% {
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 right: 0;
 opacity: 0;
 }
 100% {
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 right: 0;
 opacity: 0;
 }
 `)]),Cr=Object.assign(Object.assign({},ke.props),{processing:Boolean,type:{type:String,default:"line"},gapDegree:Number,gapOffsetDegree:Number,status:{type:String,default:"default"},railColor:[String,Array],railStyle:[String,Array],color:[String,Array,Object],viewBoxWidth:{type:Number,default:100},strokeWidth:{type:Number,default:7},percentage:[Number,Array],unit:{type:String,default:"%"},showIndicator:{type:Boolean,default:!0},indicatorPosition:{type:String,default:"outside"},indicatorPlacement:{type:String,default:"outside"},indicatorTextColor:String,circleGap:{type:Number,default:1},height:Number,borderRadius:[String,Number],fillBorderRadius:[String,Number],offsetDegree:Number}),Sr=ae({name:"Progress",props:Cr,setup(e){const n=I(()=>e.indicatorPlacement||e.indicatorPosition),g=I(()=>{if(e.gapDegree||e.gapDegree===0)return e.gapDegree;if(e.type==="dashboard")return 75}),{mergedClsPrefixRef:w,inlineThemeDisabled:d}=ot(e),u=ke("Progress","-progress",xr,ar,e,w),c=I(()=>{const{status:z}=e,{common:{cubicBezierEaseInOut:R},self:{fontSize:$,fontSizeCircle:T,railColor:p,railHeight:P,iconSizeCircle:k,iconSizeLine:a,textColorCircle:O,textColorLineInner:_,textColorLineOuter:M,lineBgProcessing:U,fontWeightCircle:j,[Ae("iconColor",z)]:D,[Ae("fillColor",z)]:G}}=u.value;return{"--n-bezier":R,"--n-fill-color":G,"--n-font-size":$,"--n-font-size-circle":T,"--n-font-weight-circle":j,"--n-icon-color":D,"--n-icon-size-circle":k,"--n-icon-size-line":a,"--n-line-bg-processing":U,"--n-rail-color":p,"--n-rail-height":P,"--n-text-color-circle":O,"--n-text-color-line-inner":_,"--n-text-color-line-outer":M}}),h=d?De("progress",I(()=>e.status[0]),c,e):void 0;return{mergedClsPrefix:w,mergedIndicatorPlacement:n,gapDeg:g,cssVars:d?void 0:c,themeClass:h?.themeClass,onRender:h?.onRender}},render(){const{type:e,cssVars:n,indicatorTextColor:g,showIndicator:w,status:d,railColor:u,railStyle:c,color:h,percentage:z,viewBoxWidth:R,strokeWidth:$,mergedIndicatorPlacement:T,unit:p,borderRadius:P,fillBorderRadius:k,height:a,processing:O,circleGap:_,mergedClsPrefix:M,gapDeg:U,gapOffsetDegree:j,themeClass:D,$slots:G,onRender:A}=this;return A?.(),o("div",{class:[D,`${M}-progress`,`${M}-progress--${e}`,`${M}-progress--${d}`],style:n,"aria-valuemax":100,"aria-valuemin":0,"aria-valuenow":z,role:e==="circle"||e==="line"||e==="dashboard"?"progressbar":"none"},e==="circle"||e==="dashboard"?o(br,{clsPrefix:M,status:d,showIndicator:w,indicatorTextColor:g,railColor:u,fillColor:h,railStyle:c,offsetDegree:this.offsetDegree,percentage:z,viewBoxWidth:R,strokeWidth:$,gapDegree:U===void 0?e==="dashboard"?75:0:U,gapOffsetDegree:j,unit:p},G):e==="line"?o(wr,{clsPrefix:M,status:d,showIndicator:w,indicatorTextColor:g,railColor:u,fillColor:h,railStyle:c,percentage:z,processing:O,indicatorPlacement:T,unit:p,fillBorderRadius:k,railBorderRadius:P,height:a},G):e==="multiple-circle"?o(kr,{clsPrefix:M,strokeWidth:$,railColor:u,fillColor:h,railStyle:c,viewBoxWidth:R,percentage:z,showIndicator:w,circleGap:_},G):null)}}),$r=Q([i("slider",`
 display: block;
 padding: calc((var(--n-handle-size) - var(--n-rail-height)) / 2) 0;
 position: relative;
 z-index: 0;
 width: 100%;
 cursor: pointer;
 user-select: none;
 -webkit-user-select: none;
 `,[N("reverse",[i("slider-handles",[i("slider-handle-wrapper",`
 transform: translate(50%, -50%);
 `)]),i("slider-dots",[i("slider-dot",`
 transform: translateX(50%, -50%);
 `)]),N("vertical",[i("slider-handles",[i("slider-handle-wrapper",`
 transform: translate(-50%, -50%);
 `)]),i("slider-marks",[i("slider-mark",`
 transform: translateY(calc(-50% + var(--n-dot-height) / 2));
 `)]),i("slider-dots",[i("slider-dot",`
 transform: translateX(-50%) translateY(0);
 `)])])]),N("vertical",`
 box-sizing: content-box;
 padding: 0 calc((var(--n-handle-size) - var(--n-rail-height)) / 2);
 width: var(--n-rail-width-vertical);
 height: 100%;
 `,[i("slider-handles",`
 top: calc(var(--n-handle-size) / 2);
 right: 0;
 bottom: calc(var(--n-handle-size) / 2);
 left: 0;
 `,[i("slider-handle-wrapper",`
 top: unset;
 left: 50%;
 transform: translate(-50%, 50%);
 `)]),i("slider-rail",`
 height: 100%;
 `,[ve("fill",`
 top: unset;
 right: 0;
 bottom: unset;
 left: 0;
 `)]),N("with-mark",`
 width: var(--n-rail-width-vertical);
 margin: 0 32px 0 8px;
 `),i("slider-marks",`
 top: calc(var(--n-handle-size) / 2);
 right: unset;
 bottom: calc(var(--n-handle-size) / 2);
 left: 22px;
 font-size: var(--n-mark-font-size);
 `,[i("slider-mark",`
 transform: translateY(50%);
 white-space: nowrap;
 `)]),i("slider-dots",`
 top: calc(var(--n-handle-size) / 2);
 right: unset;
 bottom: calc(var(--n-handle-size) / 2);
 left: 50%;
 `,[i("slider-dot",`
 transform: translateX(-50%) translateY(50%);
 `)])]),N("disabled",`
 cursor: not-allowed;
 opacity: var(--n-opacity-disabled);
 `,[i("slider-handle",`
 cursor: not-allowed;
 `)]),N("with-mark",`
 width: 100%;
 margin: 8px 0 32px 0;
 `),Q("&:hover",[i("slider-rail",{backgroundColor:"var(--n-rail-color-hover)"},[ve("fill",{backgroundColor:"var(--n-fill-color-hover)"})]),i("slider-handle",{boxShadow:"var(--n-handle-box-shadow-hover)"})]),N("active",[i("slider-rail",{backgroundColor:"var(--n-rail-color-hover)"},[ve("fill",{backgroundColor:"var(--n-fill-color-hover)"})]),i("slider-handle",{boxShadow:"var(--n-handle-box-shadow-hover)"})]),i("slider-marks",`
 position: absolute;
 top: 18px;
 left: calc(var(--n-handle-size) / 2);
 right: calc(var(--n-handle-size) / 2);
 `,[i("slider-mark",`
 position: absolute;
 transform: translateX(-50%);
 white-space: nowrap;
 `)]),i("slider-rail",`
 width: 100%;
 position: relative;
 height: var(--n-rail-height);
 background-color: var(--n-rail-color);
 transition: background-color .3s var(--n-bezier);
 border-radius: calc(var(--n-rail-height) / 2);
 `,[ve("fill",`
 position: absolute;
 top: 0;
 bottom: 0;
 border-radius: calc(var(--n-rail-height) / 2);
 transition: background-color .3s var(--n-bezier);
 background-color: var(--n-fill-color);
 `)]),i("slider-handles",`
 position: absolute;
 top: 0;
 right: calc(var(--n-handle-size) / 2);
 bottom: 0;
 left: calc(var(--n-handle-size) / 2);
 `,[i("slider-handle-wrapper",`
 outline: none;
 position: absolute;
 top: 50%;
 transform: translate(-50%, -50%);
 cursor: pointer;
 display: flex;
 `,[i("slider-handle",`
 height: var(--n-handle-size);
 width: var(--n-handle-size);
 border-radius: 50%;
 overflow: hidden;
 transition: box-shadow .2s var(--n-bezier), background-color .3s var(--n-bezier);
 background-color: var(--n-handle-color);
 box-shadow: var(--n-handle-box-shadow);
 `,[Q("&:hover",`
 box-shadow: var(--n-handle-box-shadow-hover);
 `)]),Q("&:focus",[i("slider-handle",`
 box-shadow: var(--n-handle-box-shadow-focus);
 `,[Q("&:hover",`
 box-shadow: var(--n-handle-box-shadow-active);
 `)])])])]),i("slider-dots",`
 position: absolute;
 top: 50%;
 left: calc(var(--n-handle-size) / 2);
 right: calc(var(--n-handle-size) / 2);
 `,[N("transition-disabled",[i("slider-dot","transition: none;")]),i("slider-dot",`
 transition:
 border-color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 position: absolute;
 transform: translate(-50%, -50%);
 height: var(--n-dot-height);
 width: var(--n-dot-width);
 border-radius: var(--n-dot-border-radius);
 overflow: hidden;
 box-sizing: border-box;
 border: var(--n-dot-border);
 background-color: var(--n-dot-color);
 `,[N("active","border: var(--n-dot-border-active);")])])]),i("slider-handle-indicator",`
 font-size: var(--n-font-size);
 padding: 6px 10px;
 border-radius: var(--n-indicator-border-radius);
 color: var(--n-indicator-text-color);
 background-color: var(--n-indicator-color);
 box-shadow: var(--n-indicator-box-shadow);
 `,[Ee()]),i("slider-handle-indicator",`
 font-size: var(--n-font-size);
 padding: 6px 10px;
 border-radius: var(--n-indicator-border-radius);
 color: var(--n-indicator-text-color);
 background-color: var(--n-indicator-color);
 box-shadow: var(--n-indicator-box-shadow);
 `,[N("top",`
 margin-bottom: 12px;
 `),N("right",`
 margin-left: 12px;
 `),N("bottom",`
 margin-top: 12px;
 `),N("left",`
 margin-right: 12px;
 `),Ee()]),Et(i("slider",[i("slider-dot","background-color: var(--n-dot-color-modal);")])),Ht(i("slider",[i("slider-dot","background-color: var(--n-dot-color-popover);")]))]);function Ke(e){return window.TouchEvent&&e instanceof window.TouchEvent}function Ye(){const e=new Map,n=g=>w=>{e.set(g,w)};return It(()=>{e.clear()}),[e,n]}const zr=0,Rr=Object.assign(Object.assign({},ke.props),{to:Pe.propTo,defaultValue:{type:[Number,Array],default:0},marks:Object,disabled:{type:Boolean,default:void 0},formatTooltip:Function,keyboard:{type:Boolean,default:!0},min:{type:Number,default:0},max:{type:Number,default:100},step:{type:[Number,String],default:1},range:Boolean,value:[Number,Array],placement:String,showTooltip:{type:Boolean,default:void 0},tooltip:{type:Boolean,default:!0},vertical:Boolean,reverse:Boolean,"onUpdate:value":[Function,Array],onUpdateValue:[Function,Array],onDragstart:[Function],onDragend:[Function]}),Tr=ae({name:"Slider",props:Rr,slots:Object,setup(e){const{mergedClsPrefixRef:n,namespaceRef:g,inlineThemeDisabled:w}=ot(e),d=ke("Slider","-slider",$r,vr,e,n),u=V(null),[c,h]=Ye(),[z,R]=Ye(),$=V(new Set),T=Gt(e),{mergedDisabledRef:p}=T,P=I(()=>{const{step:t}=e;if(Number(t)<=0||t==="mark")return 0;const r=t.toString();let l=0;return r.includes(".")&&(l=r.length-r.indexOf(".")-1),l}),k=V(e.defaultValue),a=Pt(e,"value"),O=rr(a,k),_=I(()=>{const{value:t}=O;return(e.range?t:[t]).map(Fe)}),M=I(()=>_.value.length>2),U=I(()=>e.placement===void 0?e.vertical?"right":"top":e.placement),j=I(()=>{const{marks:t}=e;return t?Object.keys(t).map(Number.parseFloat):null}),D=V(-1),G=V(-1),A=V(-1),L=V(!1),J=V(!1),y=I(()=>{const{vertical:t,reverse:r}=e;return t?r?"top":"bottom":r?"right":"left"}),m=I(()=>{if(M.value)return;const t=_.value,r=ue(e.range?Math.min(...t):e.min),l=ue(e.range?Math.max(...t):t[0]),{value:x}=y;return e.vertical?{[x]:`${r}%`,height:`${l-r}%`}:{[x]:`${r}%`,width:`${l-r}%`}}),C=I(()=>{const t=[],{marks:r}=e;if(r){const l=_.value.slice();l.sort((q,E)=>q-E);const{value:x}=y,{value:B}=M,{range:W}=e,X=B?()=>!1:q=>W?q>=l[0]&&q<=l[l.length-1]:q<=l[0];for(const q of Object.keys(r)){const E=Number(q);t.push({active:X(E),key:E,label:r[q],style:{[x]:`${ue(E)}%`}})}}return t});function f(t,r){const l=ue(t),{value:x}=y;return{[x]:`${l}%`,zIndex:r===D.value?1:0}}function b(t){return e.showTooltip||A.value===t||D.value===t&&L.value}function F(t){return L.value?!(D.value===t&&G.value===t):!0}function lt(t){var r;~t&&(D.value=t,(r=c.get(t))===null||r===void 0||r.focus())}function it(){z.forEach((t,r)=>{b(r)&&t.syncPosition()})}function Me(t){const{"onUpdate:value":r,onUpdateValue:l}=e,{nTriggerFormInput:x,nTriggerFormChange:B}=T;l&&me(l,t),r&&me(r,t),k.value=t,x(),B()}function Ve(t){const{range:r}=e;if(r){if(Array.isArray(t)){const{value:l}=_;t.join()!==l.join()&&Me(t)}}else Array.isArray(t)||_.value[0]!==t&&Me(t)}function Ce(t,r){if(e.range){const l=_.value.slice();l.splice(r,1,t),Ve(l)}else Ve(t)}function Se(t,r,l){const x=l!==void 0;l||(l=t-r>0?1:-1);const B=j.value||[],{step:W}=e;if(W==="mark"){const E=ce(t,B.concat(r),x?l:void 0);return E?E.value:r}if(W<=0)return r;const{value:X}=P;let q;if(x){const E=Number((r/W).toFixed(X)),Z=Math.floor(E),$e=E>Z?Z:Z-1,ze=E<Z?Z:Z+1;q=ce(r,[Number(($e*W).toFixed(X)),Number((ze*W).toFixed(X)),...B],l)}else{const E=dt(t);q=ce(t,[...B,E])}return q?Fe(q.value):r}function Fe(t){return Math.min(e.max,Math.max(e.min,t))}function ue(t){const{max:r,min:l}=e;return(t-l)/(r-l)*100}function st(t){const{max:r,min:l}=e;return l+(r-l)*t}function dt(t){const{step:r,min:l}=e;if(Number(r)<=0||r==="mark")return t;const x=Math.round((t-l)/r)*r+l;return Number(x.toFixed(P.value))}function ce(t,r=j.value,l){if(!r?.length)return null;let x=null,B=-1;for(;++B<r.length;){const W=r[B]-t,X=Math.abs(W);(l===void 0||W*l>0)&&(x===null||X<x.distance)&&(x={index:B,distance:X,value:r[B]})}return x}function je(t){const r=u.value;if(!r)return;const l=Ke(t)?t.touches[0]:t,x=r.getBoundingClientRect();let B;return e.vertical?B=(x.bottom-l.clientY)/x.height:B=(l.clientX-x.left)/x.width,e.reverse&&(B=1-B),st(B)}function ut(t){if(p.value||!e.keyboard)return;const{vertical:r,reverse:l}=e;switch(t.key){case"ArrowUp":t.preventDefault(),fe(r&&l?-1:1);break;case"ArrowRight":t.preventDefault(),fe(!r&&l?-1:1);break;case"ArrowDown":t.preventDefault(),fe(r&&l?1:-1);break;case"ArrowLeft":t.preventDefault(),fe(!r&&l?1:-1);break}}function fe(t){const r=D.value;if(r===-1)return;const{step:l}=e,x=_.value[r],B=Number(l)<=0||l==="mark"?x:x+l*t;Ce(Se(B,x,t>0?1:-1),r)}function ct(t){var r,l;if(p.value||!Ke(t)&&t.button!==zr)return;const x=je(t);if(x===void 0)return;const B=_.value.slice(),W=e.range?(l=(r=ce(x,B))===null||r===void 0?void 0:r.index)!==null&&l!==void 0?l:-1:0;W!==-1&&(t.preventDefault(),lt(W),ft(),Ce(Se(x,_.value[W]),W))}function ft(){L.value||(L.value=!0,e.onDragstart&&me(e.onDragstart),be("touchend",document,he),be("mouseup",document,he),be("touchmove",document,pe),be("mousemove",document,pe))}function ge(){L.value&&(L.value=!1,e.onDragend&&me(e.onDragend),ye("touchend",document,he),ye("mouseup",document,he),ye("touchmove",document,pe),ye("mousemove",document,pe))}function pe(t){const{value:r}=D;if(!L.value||r===-1){ge();return}const l=je(t);l!==void 0&&Ce(Se(l,_.value[r]),r)}function he(){ge()}function gt(t){D.value=t,p.value||(A.value=t)}function pt(t){D.value===t&&(D.value=-1,ge()),A.value===t&&(A.value=-1)}function ht(t){A.value=t}function vt(t){A.value===t&&(A.value=-1)}Be(D,(t,r)=>{Re(()=>G.value=r)}),Be(O,()=>{if(e.marks){if(J.value)return;J.value=!0,Re(()=>{J.value=!1})}Re(it)}),Dt(()=>{ge()});const We=I(()=>{const{self:{markFontSize:t,railColor:r,railColorHover:l,fillColor:x,fillColorHover:B,handleColor:W,opacityDisabled:X,dotColor:q,dotColorModal:E,handleBoxShadow:Z,handleBoxShadowHover:$e,handleBoxShadowActive:ze,handleBoxShadowFocus:mt,dotBorder:bt,dotBoxShadow:yt,railHeight:wt,railWidthVertical:kt,handleSize:xt,dotHeight:Ct,dotWidth:St,dotBorderRadius:$t,fontSize:zt,dotBorderActive:Rt,dotColorPopover:Tt},common:{cubicBezierEaseInOut:Bt}}=d.value;return{"--n-bezier":Bt,"--n-dot-border":bt,"--n-dot-border-active":Rt,"--n-dot-border-radius":$t,"--n-dot-box-shadow":yt,"--n-dot-color":q,"--n-dot-color-modal":E,"--n-dot-color-popover":Tt,"--n-dot-height":Ct,"--n-dot-width":St,"--n-fill-color":x,"--n-fill-color-hover":B,"--n-font-size":zt,"--n-handle-box-shadow":Z,"--n-handle-box-shadow-active":ze,"--n-handle-box-shadow-focus":mt,"--n-handle-box-shadow-hover":$e,"--n-handle-color":W,"--n-handle-size":xt,"--n-opacity-disabled":X,"--n-rail-color":r,"--n-rail-color-hover":l,"--n-rail-height":wt,"--n-rail-width-vertical":kt,"--n-mark-font-size":t}}),ne=w?De("slider",void 0,We,e):void 0,Oe=I(()=>{const{self:{fontSize:t,indicatorColor:r,indicatorBoxShadow:l,indicatorTextColor:x,indicatorBorderRadius:B}}=d.value;return{"--n-font-size":t,"--n-indicator-border-radius":B,"--n-indicator-box-shadow":l,"--n-indicator-color":r,"--n-indicator-text-color":x}}),le=w?De("slider-indicator",void 0,Oe,e):void 0;return{mergedClsPrefix:n,namespace:g,uncontrolledValue:k,mergedValue:O,mergedDisabled:p,mergedPlacement:U,isMounted:Lt(),adjustedTo:Pe(e),dotTransitionDisabled:J,markInfos:C,isShowTooltip:b,shouldKeepTooltipTransition:F,handleRailRef:u,setHandleRefs:h,setFollowerRefs:R,fillStyle:m,getHandleStyle:f,activeIndex:D,arrifiedValues:_,followerEnabledIndexSet:$,handleRailMouseDown:ct,handleHandleFocus:gt,handleHandleBlur:pt,handleHandleMouseEnter:ht,handleHandleMouseLeave:vt,handleRailKeyDown:ut,indicatorCssVars:w?void 0:Oe,indicatorThemeClass:le?.themeClass,indicatorOnRender:le?.onRender,cssVars:w?void 0:We,themeClass:ne?.themeClass,onRender:ne?.onRender}},render(){var e;const{mergedClsPrefix:n,themeClass:g,formatTooltip:w}=this;return(e=this.onRender)===null||e===void 0||e.call(this),o("div",{class:[`${n}-slider`,g,{[`${n}-slider--disabled`]:this.mergedDisabled,[`${n}-slider--active`]:this.activeIndex!==-1,[`${n}-slider--with-mark`]:this.marks,[`${n}-slider--vertical`]:this.vertical,[`${n}-slider--reverse`]:this.reverse}],style:this.cssVars,onKeydown:this.handleRailKeyDown,onMousedown:this.handleRailMouseDown,onTouchstart:this.handleRailMouseDown},o("div",{class:`${n}-slider-rail`},o("div",{class:`${n}-slider-rail__fill`,style:this.fillStyle}),this.marks?o("div",{class:[`${n}-slider-dots`,this.dotTransitionDisabled&&`${n}-slider-dots--transition-disabled`]},this.markInfos.map(d=>o("div",{key:d.key,class:[`${n}-slider-dot`,{[`${n}-slider-dot--active`]:d.active}],style:d.style}))):null,o("div",{ref:"handleRailRef",class:`${n}-slider-handles`},this.arrifiedValues.map((d,u)=>{const c=this.isShowTooltip(u);return o(Zt,null,{default:()=>[o(er,null,{default:()=>o("div",{ref:this.setHandleRefs(u),class:`${n}-slider-handle-wrapper`,tabindex:this.mergedDisabled?-1:0,role:"slider","aria-valuenow":d,"aria-valuemin":this.min,"aria-valuemax":this.max,"aria-orientation":this.vertical?"vertical":"horizontal","aria-disabled":this.disabled,style:this.getHandleStyle(d,u),onFocus:()=>{this.handleHandleFocus(u)},onBlur:()=>{this.handleHandleBlur(u)},onMouseenter:()=>{this.handleHandleMouseEnter(u)},onMouseleave:()=>{this.handleHandleMouseLeave(u)}},qt(this.$slots.thumb,()=>[o("div",{class:`${n}-slider-handle`})]))}),this.tooltip&&o(tr,{ref:this.setFollowerRefs(u),show:c,to:this.adjustedTo,enabled:this.showTooltip&&!this.range||this.followerEnabledIndexSet.has(u),teleportDisabled:this.adjustedTo===Pe.tdkey,placement:this.mergedPlacement,containerClass:this.namespace},{default:()=>o(_t,{name:"fade-in-scale-up-transition",appear:this.isMounted,css:this.shouldKeepTooltipTransition(u),onEnter:()=>{this.followerEnabledIndexSet.add(u)},onAfterLeave:()=>{this.followerEnabledIndexSet.delete(u)}},{default:()=>{var h;return c?((h=this.indicatorOnRender)===null||h===void 0||h.call(this),o("div",{class:[`${n}-slider-handle-indicator`,this.indicatorThemeClass,`${n}-slider-handle-indicator--${this.mergedPlacement}`],style:this.indicatorCssVars},typeof w=="function"?w(d):d)):null}})})]})})),this.marks?o("div",{class:`${n}-slider-marks`},this.markInfos.map(d=>o("div",{key:d.key,class:`${n}-slider-mark`,style:d.style},typeof d.label=="function"?d.label():d.label))):null))}}),ee={tasks:e=>ie.get("/work-tasks",{params:e}).then(n=>n.data),task:e=>ie.get(`/work-tasks/${e}`).then(n=>n.data),createTask:e=>ie.post("/work-tasks",e).then(n=>n.data),updateTask:(e,n)=>ie.patch(`/work-tasks/${e}`,n).then(g=>g.data),deleteTask:(e,n)=>ie.delete(`/work-tasks/${e}`,{headers:{"If-Match":String(n)}}),taskTags:()=>ie.get("/work-task-tags").then(e=>e.data)},Br=[{label:"未完成",value:"未完成"},{label:"已完成",value:"已完成"}];function Ir(){return{keyword:"",tags:[],status:null}}function xe(e){const n=[],g=new Set;for(const w of e.split(/[,，]/)){const d=w.trim();d===""||g.has(d)||(g.add(d),n.push(d))}return n}function nt(e){return xe(e.join(",")).join(",")}function Qe(e){const n={};return e.keyword.trim()&&(n.keyword=e.keyword.trim()),e.tags.length>0&&(n.tags=nt(e.tags)),e.status&&(n.status=e.status),n}function _r(e){const n=String(e.status??"");return{keyword:String(e.keyword??""),tags:xe(String(e.tags??"")),status:n==="未完成"||n==="已完成"?n:null}}function Dr(e){return`${Math.min(100,Math.max(0,Math.round(e)))}%`}const Pr={class:"progress-field"},Nr={class:"modal-footer"},Mr={class:"modal-footer-left"},Vr={class:"modal-footer-right"},Fr=ae({__name:"WorkTaskFormModal",props:{show:{type:Boolean},taskId:{default:null},readonly:{type:Boolean,default:!1}},emits:["update:show","saved"],setup(e,{emit:n}){const g=e,w=n,d=nr(),u=lr(),c=I(()=>g.taskId!==null&&g.taskId!==void 0),h=V(null),z=V(!1),R=V(!1),$=V(!1),T=V([]),p=V(!1),P=V([]),k=V(1),a=Mt({name:"",steps:"",start:null,end:null,owner:"",progress:0,remark:"",tags:[]}),O={name:{required:!0,message:"请输入工作任务",trigger:["input","blur"]}};function _(){Object.assign(a,{name:"",steps:"",start:null,end:null,owner:"",progress:0,remark:"",tags:[]}),T.value=[],k.value=1,h.value?.restoreValidation()}function M(y){Object.assign(a,{name:y.name,steps:y.steps??"",start:Ge(y.start_date),end:Ge(y.end_date),owner:y.owner??"",progress:y.progress,remark:y.remark??"",tags:xe(y.tags)}),T.value=[...y.images],k.value=y.version}async function U(){try{P.value=(await ee.taskTags()).map(y=>({label:y,value:y}))}catch{}}async function j(){z.value=!0,_();try{await U(),c.value&&g.taskId!==null&&g.taskId!==void 0&&M(await ee.task(g.taskId))}catch(y){d.error(y instanceof Error?y.message:"加载任务失败")}finally{z.value=!1}}Be(()=>g.show,y=>{y&&j()});function D(){w("update:show",!1)}const G=I(()=>{const y=new Set(P.value.map(C=>String(C.value)));return[...a.tags.filter(C=>!y.has(C)).map(C=>({label:C,value:C})),...P.value]});function A(){return{name:a.name.trim(),steps:a.steps.trim()||null,start_date:a.start===null?null:qe(a.start),end_date:a.end===null?null:qe(a.end),owner:a.owner.trim()||null,progress:a.progress??0,remark:a.remark.trim()||null,tags:nt(a.tags),image_ids:T.value.map(y=>y.id)}}async function L(){try{await h.value?.validate()}catch{return}if(a.start!==null&&a.end!==null&&a.end<a.start){d.error("完成时间不能早于开始时间");return}R.value=!0;try{if(c.value&&g.taskId!==null&&g.taskId!==void 0){const y=await ee.task(g.taskId);await ee.updateTask(g.taskId,{...A(),version:y.version}),d.success("保存成功")}else await ee.createTask(A()),d.success("新增成功");w("saved"),D()}catch(y){d.error(y instanceof Error?y.message:"保存失败")}finally{R.value=!1}}function J(){const y=g.taskId;y!=null&&u.warning({draggable:!0,title:"确认删除任务",content:`确定删除“${a.name}”吗？删除后不可恢复。`,positiveText:"确认删除",negativeText:"取消",onPositiveClick:async()=>{$.value=!0;try{await ee.deleteTask(y,k.value),d.success("任务已删除"),w("saved"),D()}catch(m){return d.error(m instanceof Error?m.message:"删除失败"),!1}finally{$.value=!1}return!0}})}return(y,m)=>(te(),we(s(Xt),{show:e.show,preset:"card",draggable:"",title:e.readonly?"任务详情":c.value?"编辑任务":"新增任务",style:{width:"min(760px, calc(100vw - 24px))"},"mask-closable":!1,"onUpdate:show":D},{footer:S(()=>[H("div",Nr,[H("div",Mr,[c.value&&!e.readonly?(te(),we(s(oe),{key:0,type:"error",ghost:"",loading:$.value,onClick:J},{default:S(()=>[...m[12]||(m[12]=[re(" 删除 ",-1)])]),_:1},8,["loading"])):Ie("",!0)]),H("div",Vr,[e.readonly?(te(),we(s(oe),{key:0,onClick:D},{default:S(()=>[...m[13]||(m[13]=[re("关闭",-1)])]),_:1})):(te(),_e(Nt,{key:1},[v(s(oe),{onClick:D},{default:S(()=>[...m[14]||(m[14]=[re("取消",-1)])]),_:1}),v(s(oe),{type:"primary",loading:R.value,disabled:p.value,onClick:L},{default:S(()=>[...m[15]||(m[15]=[re("保存",-1)])]),_:1},8,["loading","disabled"])],64))])])]),default:S(()=>[v(s(sr),{ref_key:"formRef",ref:h,model:a,rules:O,"label-placement":"top",size:"small",disabled:z.value||e.readonly},{default:S(()=>[v(s(ir),{cols:2,"x-gap":20,"y-gap":20},{default:S(()=>[v(s(K),{span:2},{default:S(()=>[v(s(Y),{label:"工作任务",path:"name"},{default:S(()=>[v(s(de),{value:a.name,"onUpdate:value":m[0]||(m[0]=C=>a.name=C),type:"textarea",autosize:{minRows:1,maxRows:3},maxlength:"500","show-count":"",placeholder:"如：311区域流量计未试运"},null,8,["value"])]),_:1})]),_:1}),v(s(K),{span:2},{default:S(()=>[v(s(Y),{label:"事项或步骤"},{default:S(()=>[v(s(de),{value:a.steps,"onUpdate:value":m[1]||(m[1]=C=>a.steps=C),type:"textarea",autosize:{minRows:2,maxRows:5},maxlength:"1000",placeholder:"这一步要做什么、有什么注意事项"},null,8,["value"])]),_:1})]),_:1}),v(s(K),null,{default:S(()=>[v(s(Y),{label:"开始时间"},{default:S(()=>[v(s(Le),{value:a.start,"onUpdate:value":m[2]||(m[2]=C=>a.start=C),type:"date",clearable:"",class:"full-width"},null,8,["value"])]),_:1})]),_:1}),v(s(K),null,{default:S(()=>[v(s(Y),{label:"完成时间"},{default:S(()=>[v(s(Le),{value:a.end,"onUpdate:value":m[3]||(m[3]=C=>a.end=C),type:"date",clearable:"",class:"full-width"},null,8,["value"])]),_:1})]),_:1}),v(s(K),null,{default:S(()=>[v(s(Y),{label:"责任人"},{default:S(()=>[v(s(de),{value:a.owner,"onUpdate:value":m[4]||(m[4]=C=>a.owner=C),maxlength:"255",placeholder:"如：王杰，李刚，方向清"},null,8,["value"])]),_:1})]),_:1}),v(s(K),null,{default:S(()=>[v(s(Y),{label:"完成度"},{default:S(()=>[H("div",Pr,[v(s(Tr),{value:a.progress,"onUpdate:value":m[5]||(m[5]=C=>a.progress=C),min:0,max:100,step:1},null,8,["value"]),v(s(dr),{value:a.progress,"onUpdate:value":m[6]||(m[6]=C=>a.progress=C),min:0,max:100,"show-button":!1,class:"progress-number"},null,8,["value"]),m[11]||(m[11]=H("span",{class:"progress-suffix"},"%",-1))])]),_:1})]),_:1}),v(s(K),{span:2},{default:S(()=>[v(s(Y),{label:"备注"},{default:S(()=>[v(s(de),{value:a.remark,"onUpdate:value":m[7]||(m[7]=C=>a.remark=C),type:"textarea",autosize:{minRows:2,maxRows:5},maxlength:"1000",placeholder:"处理结果、待办事项等"},null,8,["value"])]),_:1})]),_:1}),v(s(K),{span:2},{default:S(()=>[v(s(Y),{label:"标签"},{default:S(()=>[v(s(Ne),{value:a.tags,"onUpdate:value":m[8]||(m[8]=C=>a.tags=C),options:G.value,multiple:"",filterable:"",tag:"",clearable:"","max-tag-count":8,placeholder:"选择已有标签或直接输入新标签，回车添加"},null,8,["value","options"])]),_:1})]),_:1}),v(s(K),{span:2},{default:S(()=>[v(s(Y),{label:"图片附件"},{default:S(()=>[v(Jt,{files:T.value,"onUpdate:files":m[9]||(m[9]=C=>T.value=C),busy:p.value,"onUpdate:busy":m[10]||(m[10]=C=>p.value=C),disabled:e.readonly},null,8,["files","busy","disabled"])]),_:1})]),_:1})]),_:1})]),_:1},8,["model","disabled"])]),_:1},8,["show","title"]))}}),jr=at(Fr,[["__scopeId","data-v-1037da28"]]),Wr={class:"page"},Or={class:"filter-panel"},Ur={class:"filter-grid"},Ar={class:"filter-field"},Er={class:"filter-field"},Hr={class:"filter-field"},qr={class:"filter-actions"},Gr={key:0,class:"filter-count"},Lr={class:"filter-action-buttons"},Xr={class:"pagination-bar"},Kr=ae({__name:"WorkTasksView",setup(e){const n=Kt(),g=I(()=>n.can("work:write")),w=gr(),d=V(!1),u=V(null),c=V([]),{items:h,total:z,page:R,pageSize:$,loading:T,filters:p,pageSizeOptions:P,query:k,changePage:a,changePageSize:O,resetFilters:_}=fr({fetch:(f,b)=>ee.tasks({page:b.page,page_size:b.page_size,...Qe(f)}),initialFilters:Ir,rollbackEmptyPage:!0,urlSync:{routeName:"work-tasks",fromQuery:f=>_r(f.query),toQuery:f=>Qe(f)}}),M=I(()=>[p.keyword.trim()||null,p.tags.length>0?"tags":null,p.status].filter(f=>f!==null&&f!=="").length),U=[{key:"index",label:"序号",column:{title:"序号",key:"index",width:64,render:(f,b)=>(R.value-1)*$.value+b+1}},{key:"name",label:"工作任务",column:{title:"工作任务",key:"name",minWidth:220,ellipsis:{tooltip:!0}}},{key:"steps",label:"事项或步骤",column:{title:"事项或步骤",key:"steps",minWidth:200,ellipsis:{tooltip:!0},render:f=>f.steps||"—"}},{key:"start_date",label:"开始时间",column:{title:"开始时间",key:"start_date",width:Te.date,render:f=>f.start_date||"—"}},{key:"end_date",label:"完成时间",column:{title:"完成时间",key:"end_date",width:Te.date,render:f=>f.end_date||"—"}},{key:"owner",label:"责任人",column:{title:"责任人",key:"owner",width:Te.person,ellipsis:{tooltip:!0},render:f=>f.owner||"—"}},{key:"progress",label:"完成度",column:{title:"完成度",key:"progress",width:150,render:f=>o("div",{class:"progress-cell"},[o(Sr,{type:"line",percentage:Math.min(100,Math.max(0,f.progress)),height:6,showIndicator:!1,status:f.progress>=100?"success":"default"}),o("span",{class:"progress-text"},Dr(f.progress))])}},{key:"remark",label:"备注",column:{title:"备注",key:"remark",minWidth:180,ellipsis:{tooltip:!0},render:f=>f.remark||"—"}},{key:"tags",label:"标签",column:{title:"标签",key:"tags",width:180,render:f=>{const b=xe(f.tags);return b.length===0?"—":o("div",{class:"action-row"},b.map(F=>o(pr,{size:"small",bordered:!1,type:"info"},{default:()=>F})))}}},{key:"images",label:"图片",column:{title:"图片",key:"images",width:140,render:f=>o(Qt,{images:f.images})}}],j=V(U.map(f=>f.key)),D=U.map(f=>({label:f.label,value:f.key})),G=I(()=>ur(U.filter(f=>j.value.includes(f.key)).map(f=>f.column))),A=I(()=>cr(G.value));async function L(){try{c.value=(await ee.taskTags()).map(f=>({label:f,value:f}))}catch{}}function J(){u.value=null,d.value=!0}function y(f){u.value=f.id,d.value=!0}function m(f){return{style:"cursor: pointer",onMousedown:w.onMouseDown,onClick:b=>{w.shouldIgnore(b)||y(f)}}}async function C(){await k(),await L()}return Vt(L),(f,b)=>(te(),_e("div",Wr,[v(s(He),{class:"filter-card",bordered:!1},{default:S(()=>[H("div",Or,[H("div",Ur,[H("label",Ar,[b[7]||(b[7]=H("span",null,"关键词",-1)),v(s(de),{value:s(p).keyword,"onUpdate:value":b[0]||(b[0]=F=>s(p).keyword=F),placeholder:"工作任务 / 事项或步骤 / 责任人 / 备注 / 标签，可用 | 分隔",clearable:"",onKeyup:Ft(s(k),["enter"])},null,8,["value","onKeyup"])]),H("label",Er,[b[8]||(b[8]=H("span",null,"标签",-1)),v(s(Ne),{value:s(p).tags,"onUpdate:value":b[1]||(b[1]=F=>s(p).tags=F),options:c.value,multiple:"",filterable:"",clearable:"","max-tag-count":3,placeholder:"可多选，命中任意一个即可"},null,8,["value","options"])]),H("label",Hr,[b[9]||(b[9]=H("span",null,"完成状态",-1)),v(s(Ne),{value:s(p).status,"onUpdate:value":b[2]||(b[2]=F=>s(p).status=F),options:s(Br),placeholder:"不限",clearable:""},null,8,["value","options"])])]),H("div",qr,[M.value?(te(),_e("span",Gr,"已启用 "+jt(M.value)+" 项",1)):Ie("",!0),v(Yt,{value:j.value,options:s(D),"storage-key":"work.work-tasks.visible-columns.v1","onUpdate:value":b[3]||(b[3]=F=>j.value=F)},null,8,["value","options"]),H("div",Lr,[g.value?(te(),we(s(oe),{key:0,type:"primary",onClick:J},{default:S(()=>[...b[10]||(b[10]=[re("新增任务",-1)])]),_:1})):Ie("",!0),v(s(oe),{onClick:s(_)},{default:S(()=>[...b[11]||(b[11]=[re("重置",-1)])]),_:1},8,["onClick"]),v(s(oe),{type:"primary",onClick:s(k)},{default:S(()=>[...b[12]||(b[12]=[re("查询",-1)])]),_:1},8,["onClick"])])])])]),_:1}),v(s(He),{class:"data-card",bordered:!1},{default:S(()=>[v(Wt,{"storage-key":"work/work-tasks",remote:"",bordered:!1,columns:G.value,data:s(h),loading:s(T),"row-props":m,"row-key":F=>F.id,"scroll-x":A.value},null,8,["columns","data","loading","row-key","scroll-x"]),H("div",Xr,[v(s(Ot),{page:s(R),"onUpdate:page":[b[4]||(b[4]=F=>Ue(R)?R.value=F:null),s(a)],"page-size":s($),"onUpdate:pageSize":[b[5]||(b[5]=F=>Ue($)?$.value=F:null),s(O)],"item-count":s(z),"page-sizes":s(P),"show-size-picker":""},null,8,["page","page-size","item-count","page-sizes","onUpdate:page","onUpdate:pageSize"])])]),_:1}),v(jr,{show:d.value,"onUpdate:show":b[6]||(b[6]=F=>d.value=F),"task-id":u.value,readonly:!g.value,onSaved:C},null,8,["show","task-id","readonly"])]))}}),Go=at(Kr,[["__scopeId","data-v-dd835b90"]]);export{Go as default};
