// src/utils/PrettyRobot.ts
import type { Point } from './RobotArm';

// Robot arm color variables
export const ARM_COLORS = {
    firstLinkFill: '#777',
    firstLinkStroke: '#444',
    elbowJointFill: '#555',
    secondLinkFill: '#999',
    secondLinkStroke: '#666',
    wristJointFill: '#444',
};

export function renderRobotArm(
    ctx: CanvasRenderingContext2D,
    base: Point,
    angles: [number, number],
    limbLengths: [number, number],
    colors: typeof ARM_COLORS = ARM_COLORS
) {
    const [θ1, θ2] = angles;
    const [l1, l2] = limbLengths;

    ctx.save();
    ctx.translate(base.x, base.y);

    // first link
    ctx.rotate(θ1);
    ctx.fillStyle = colors.firstLinkFill;
    ctx.strokeStyle = colors.firstLinkStroke;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(l1, -8);
    ctx.lineTo(l1, 8);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Elbow joint
    ctx.beginPath();
    ctx.fillStyle = colors.elbowJointFill;
    ctx.arc(l1, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // second link
    ctx.translate(l1, 0);
    ctx.rotate(θ2);
    ctx.fillStyle = colors.secondLinkFill;
    ctx.strokeStyle = colors.secondLinkStroke;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(l2, -6);
    ctx.lineTo(l2, 6);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wrist joint
    ctx.beginPath();
    ctx.fillStyle = colors.wristJointFill;
    ctx.arc(l2, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}
