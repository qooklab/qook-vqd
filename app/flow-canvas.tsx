"use client";
import {useEffect,useRef} from "react";

export default function FlowCanvas(){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current;
    if(!canvas)return;
    const ctx=canvas.getContext("2d");
    if(!ctx)return;
    const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame=0,elapsed=0,previous=0,visible=true;
    let px=.5,py=.5;
    function follow(e:PointerEvent){if(!canvas||motion.matches)return;const box=canvas.getBoundingClientRect();px=(e.clientX-box.left)/box.width;py=(e.clientY-box.top)/box.height;}
    function reset(){px=.5;py=.5;}
    canvas.addEventListener("pointermove",follow);canvas.addEventListener("pointerleave",reset);
    function paint(){
      if(!canvas||!ctx)return;
      const w=canvas.clientWidth,h=canvas.clientHeight;
      const ratio=Math.min(window.devicePixelRatio||1,2);
      if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){
        canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
      }
      ctx.setTransform(ratio,0,0,ratio,0,0);
      ctx.clearRect(0,0,w,h);
      const light=ctx.createRadialGradient(px*w,py*h,0,px*w,py*h,w*.54);
      light.addColorStop(0,"rgba(80,216,187,.27)");light.addColorStop(1,"transparent");ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
      for(let strand=0;strand<28;strand++){
        ctx.beginPath();
        for(let step=0;step<=64;step++){
          const t=step/64;
          const y=h*(.52+.2*Math.sin(t*8+strand*.11+elapsed/6200+px)+.14*Math.cos(t*5+strand*.19)+(py-.5)*.15);
          if(step===0)ctx.moveTo(0,y);else ctx.lineTo(t*w,y);
        }
        ctx.strokeStyle=strand<16?"rgba(114,231,207,.23)":"rgba(239,203,148,.19)";ctx.stroke();
      }
      const cy=h*.55,r=Math.min(w/12,h*.32),nodes=[w/6,w/2,5*w/6];
      function dot(x:number,y:number,size:number,color:string){
        ctx!.fillStyle=color;ctx!.beginPath();ctx!.arc(x,y,size,0,2*Math.PI);ctx!.fill();
      }
      ctx.strokeStyle="#789487";ctx.lineWidth=1;
      // Several input paths converge through the filter into one evaluated result.
      for(let j=-3;j<=3;j++){
        const sy=cy+j*r*.24;
        ctx.beginPath();ctx.moveTo(nodes[0]+r*.45,sy);
        ctx.bezierCurveTo(w*.31,sy,w*.37,cy+j*r*.09,nodes[1]-r*.65,cy+j*r*.09);
        ctx.strokeStyle="rgba(173,198,174,.44)";ctx.stroke();
        dot(nodes[0]-Math.abs(j%2)*r*.35,sy,2.3,"#c5d9bf");
      }
      ctx.strokeStyle="#a7baaa";ctx.beginPath();ctx.moveTo(nodes[1]+r*.6,cy);ctx.lineTo(nodes[2]-r*.78,cy);ctx.stroke();
      for(let i=-1;i<=1;i++){
        ctx.beginPath();ctx.ellipse(nodes[1]+i*r*.23,cy,r*.25,r*(.8-i*.14),0,0,2*Math.PI);ctx.stroke();
      }
      for(const scale of [.84,.58,.32]){
        ctx.beginPath();ctx.arc(nodes[2],cy,r*scale,0,2*Math.PI);ctx.strokeStyle="#abc4b3";ctx.stroke();
      }
      dot(nodes[2],cy,3,"#f2d8a1");
      const phase=(elapsed/4200)%1;
      dot(nodes[1]+r*.6+phase*(nodes[2]-nodes[1]-r*1.38),cy,2.8,"#efd2a0");
    }
    function tick(now:number){
      if(previous)elapsed+=Math.min(now-previous,80);
      previous=now;paint();
      frame=requestAnimationFrame(tick);
    }
    function sync(){
      cancelAnimationFrame(frame);previous=0;paint();
      if(visible&&!document.hidden&&!motion.matches)frame=requestAnimationFrame(tick);
    }
    const resize=new ResizeObserver(sync);resize.observe(canvas);
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});observer.observe(canvas);
    motion.addEventListener("change",sync);document.addEventListener("visibilitychange",sync);sync();
    return ()=>{cancelAnimationFrame(frame);canvas.removeEventListener("pointermove",follow);canvas.removeEventListener("pointerleave",reset);resize.disconnect();observer.disconnect();motion.removeEventListener("change",sync);document.removeEventListener("visibilitychange",sync);};
  },[]);
  return <canvas aria-hidden="true" ref={ref}/>;
}
