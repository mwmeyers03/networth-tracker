/** SVG geometry uses the measured container, including a narrow phone drawer. */
export function chartLayout(containerWidth) {
 const width=Math.max(160,Math.round(Number.isFinite(containerWidth)?containerWidth:320));
 const narrow=width<600;
 return {width,height:narrow?240:300,left:narrow?58:66,right:narrow?16:22,top:22,bottom:35,tickCount:narrow?3:4};
}
/** Select a data index without capturing touch scrolling or assuming 1000px. */
export function chartIndex(clientX,bounds,count,layout) {
 if(count<2||bounds.width<=0)return 0;
 const pixel=(clientX-bounds.left)/bounds.width*layout.width;
 const plot=layout.width-layout.left-layout.right;
 return Math.max(0,Math.min(count-1,Math.round((pixel-layout.left)/plot*(count-1))));
}
