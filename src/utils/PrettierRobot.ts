// src/utils/PrettyRobot.ts
import type { Point } from './RobotArm';

export function renderRobotArm(
  ctx: CanvasRenderingContext2D,
  base: Point,
  angles: [number, number],
  limbLengths: [number, number]
) {
  const [theta1, theta2] = angles;
  const [l1, l2] = limbLengths;

  // Visual params
  const baseWidth = 70;     // triangle width
  const baseHeight = 46;    // triangle height below the pivot
  const linkThickness = 14; // link width
  const jointRadius = 9;    // joint circle radius

  // Draw base triangle first (fixed, upright)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);                                   // apex at the pivot
  ctx.lineTo(base.x - baseWidth / 2, base.y + baseHeight);      // bottom left
  ctx.lineTo(base.x + baseWidth / 2, base.y + baseHeight);      // bottom right
  ctx.closePath();
  ctx.fillStyle = '#2c2f39';
  ctx.strokeStyle = '#121318';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  // Base joint on top of triangle
  drawJoint(ctx, base.x, base.y, jointRadius, '#444', '#121318');

  // Link 1 in its own transform
  ctx.translate(base.x, base.y);
  ctx.rotate(theta1);
  drawLink(ctx, l1, linkThickness, '#7a8cff', '#2d3a66');

  // Elbow joint at end of link 1
  drawJoint(ctx, l1, 0, jointRadius, '#555', '#2d3a66');

  // Link 2 from elbow, rotated by theta2
  ctx.translate(l1, 0);
  ctx.rotate(theta2);
  drawLink(ctx, l2, linkThickness, '#7a8cff', '#2d3a66');

  // Wrist joint at end of link 2
  drawJoint(ctx, l2, 0, jointRadius * 0.9, '#666', '#8a5a2c');
  ctx.restore();

  // Helpers
  function drawJoint(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    fill: string,
    stroke: string
  ) {
    c.save();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.fill();
    c.stroke();
    c.restore();
  }

  // Draws a pill shaped link along +X from local origin
  function drawLink(
    c: CanvasRenderingContext2D,
    length: number,
    thickness: number,
    fill: string,
    stroke: string
  ) {
    c.save();
    const r = thickness / 2;

    // body rectangle
    c.beginPath();
    c.moveTo(0, -r);
    c.lineTo(length, -r);
    c.lineTo(length, r);
    c.lineTo(0, r);
    c.closePath();
    c.fillStyle = fill;
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.fill();
    c.stroke();

    // rounded caps
    c.beginPath(); // front cap
    c.arc(length, 0, r, -Math.PI / 2, Math.PI / 2);
    c.fill();
    c.stroke();

    c.beginPath(); // back cap
    c.arc(0, 0, r, Math.PI / 2, -Math.PI / 2, true);
    c.fill();
    c.stroke();

    c.restore();
  }
}
