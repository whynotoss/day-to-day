import { world, system } from "@minecraft/server";

// Timings (in ticks)
const DAY_TICKS = 24000;

// Animation speeds
const DASH_TICKS = 8;
const DASH_HOLD = 15;
const LETTER_TICKS = 6;
const END_HOLD = 60;
const OUT_TICKS = 5;

/**
 * Builds the animation schedule for the given day.
 * Each frame contains the text, duration in ticks, and whether to play a sound.
 */
function buildSchedule(dayNumber) {
    const core = `DAY ${dayNumber}`;
    const schedule = [];

    // Intro: Dashes sliding in
    const dashFrames = ["", "—", "——"];
    for (let i = 0; i < dashFrames.length; i++) {
        const isLast = i === dashFrames.length - 1;
        schedule.push({
            msg: dashFrames[i],
            ticks: isLast ? DASH_HOLD : DASH_TICKS,
            playSound: i > 0
        });
    }

    // Split dashes
    schedule.push({
        msg: "— —",
        ticks: DASH_TICKS,
        playSound: true
    });

    // Intro: Type letters
    for (let i = 1; i <= core.length; i++) {
        const isLast = i === core.length;
        schedule.push({
            msg: `— ${core.slice(0, i)} —`,
            ticks: isLast ? END_HOLD : LETTER_TICKS,
            playSound: true
        });
    }

    // Outro: Delete letters backward
    for (let i = core.length - 1; i >= 1; i--) {
        schedule.push({
            msg: `— ${core.slice(0, i)} —`,
            ticks: OUT_TICKS,
            playSound: false
        });
    }

    // Outro: Close dashes
    schedule.push({ msg: "— —", ticks: OUT_TICKS, playSound: false });
    schedule.push({ msg: "——", ticks: OUT_TICKS, playSound: false });
    schedule.push({ msg: "—", ticks: OUT_TICKS, playSound: false });
    
    // Force clear actionbar with a space
    schedule.push({ msg: " ", ticks: 1, playSound: false });

    return schedule;
}

let animId = null;
let schedule = [];
let frameIndex = 0;
let frameTick = 0;

function stopAnimation() {
    if (animId !== null) {
        system.clearRun(animId);
        animId = null;
    }
}

function startSunriseAnimation(dayNumber) {
    stopAnimation();

    schedule = buildSchedule(dayNumber);
    frameIndex = 0;
    frameTick = 0;

    animId = system.runInterval(() => {
        if (frameIndex >= schedule.length) {
            stopAnimation();
            return;
        }

        const { msg, ticks, playSound } = schedule[frameIndex];

        // Play typing sound on the first tick of the frame
        if (frameTick === 0 && playSound) {
            for (const player of world.getAllPlayers()) {
                player.playSound("random.click", { pitch: 1.6, volume: 1.0 });
            }
        }

        // Spam actionbar every tick to prevent it from fading early
        for (const player of world.getAllPlayers()) {
            player.onScreenDisplay.setActionBar(msg);
        }

        frameTick++;
        if (frameTick >= ticks) {
            frameIndex++;
            frameTick = 0;
        }
    }, 1);
}

let prevTime = -1;

system.runInterval(() => {
    const currentTime = world.getTimeOfDay();

    // Any backward jump in time means a new day started.
    // This handles both natural tick rollover (23999 -> 0) and bed sleep skips.
    if (prevTime !== -1 && currentTime < prevTime) {
        const absoluteTime = world.getAbsoluteTime();
        const dayNumber = Math.floor(absoluteTime / DAY_TICKS) + 1;
        startSunriseAnimation(dayNumber);
    }

    prevTime = currentTime;
}, 1);
