export class DrawReachableArea {
  private ctx: CanvasRenderingContext2D;
  private base: { x: number; y: number };

  constructor(ctx: CanvasRenderingContext2D, base: { x: number; y: number }) {
    this.ctx = ctx;
    this.base = base;
  }

  drawReachableArea(maxReach: number): void {
    this.ctx.save();
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeStyle = 'rgba(100,100,100,0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(this.base.x, this.base.y, maxReach, 0, 2 * Math.PI);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }
}
