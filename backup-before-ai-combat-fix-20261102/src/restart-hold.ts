// Restart only after an uninterrupted hold without a gun drawn.
export class RestartHold{
 elapsed=0;
 readonly seconds:number;
 constructor(seconds:number){this.seconds=seconds;}
 get progress(){return Math.min(1,this.elapsed/this.seconds);}
 clear(){this.elapsed=0;}
 step(dt:number,pressed:boolean,gunDrawn:boolean){if(!pressed||gunDrawn){this.clear();return false;}this.elapsed+=dt;return this.elapsed>=this.seconds;}
}
