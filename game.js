const DEBUG = false;
const PLAYER_OFFSET_X = 40;
const PLAYER_OFFSET_Y = 80;
const PLAYER_WIDTH = 80;
const PLAYER_HEIGHT = 120;

let hitZoneWidth, hitZoneHeight, catchDistance, runnerProximity;
let pitcher, batter, ball, bases, fielders, runners = [];
let lineup, currentBatter = 0;
let score = { home: 0, away: 0 }, outs = 0, strikes = 0, inning = 1, topInning = true;
let ballMoving = false, ballHit = false, pitchAnimation = false, swingAttempt = false;
let settingMenu = false, inputEnabled = false;
let showOutPopup = false, ballCaughtThisFrame = false;
let outPopupTime = 0;
let currentPerspective = "side";

let initialFielderPositions = [];
const catchingRadius = 100;

let bgImage, batterGif;
let settingButton, returnButton;
let tempSwapPerspective;

function preload() {
    bgImage = loadImage('assets/gamebackg.jpg');
    batterGif = loadImage('assets/temp_assets/BATTER.gif');
    fielderIdleGif = loadImage('assets/temp_assets/IDLE1.gif');
    runnerRunningGif = loadImage('assets/temp_assets/RRUNGIF.gif');
    fielderRunningGif = loadImage('assets/temp_assets/LRUNGIF.gif');
    runnerIdle = loadImage('assets/temp_assets/sprites/01_idle2.png');
    catcherImg = loadImage('assets/temp_assets/sprites/01_Catch.png');

    currSong = loadSound('sounds/gamesong.mp3');
    soundEffects["buttonSound"] = loadSound('sounds/buttonClick.mp3');
    soundEffects["hitBall"] = loadSound('sounds/baseballBatHitBall.mp3');
}

function setup() {
    createCanvas(windowWidth, windowHeight);

    hitZoneWidth = windowWidth * 0.05;
    hitZoneHeight = windowHeight * 0.04;
    catchDistance = windowWidth * 0.015;
    runnerProximity = windowWidth * 0.01;
    strikeCatchThreshold = windowWidth * 0.01;

    canvas.getContext('2d', { willReadFrequently: true });

    loadVolumeSetting();
    if (currSong.isLoaded() && !currSong.isPlaying()) {
        currSong.loop();
    }

    // Calculate positions based on canvas size
    bases = [
        { x: width * 0.5, y: height * 0.78 },   // Home plate
        { x: width * 0.86, y: height * 0.525 },  // 1st base
        { x: width * 0.5, y: height * 0.48 },   // 2nd base
        { x: width * 0.125, y: height * 0.52 }    // 3rd base
    ];

    pitcher = { x: width * 0.5, y: height * 0.50, armAngle: 0 };
    ball = {
        x: pitcher.x,
        y: pitcher.y,
        speedY: 5,
        speedX: 0,
        throwing: false,
        inAir: false,
        advancingRunner: null,
        strikePitch: false
    };

    batter = {
        x: width * 0.5,
        y: height * 0.80,
        running: false,
        speed: 4,
        base: 0,
        safe: false,
        backtracking: false
    };
    catcherPlayer = { x: width * 0.5, y: height * 0.85, state: "idle", isCatcher: true };

    // Fielders positioned at (or near) the bases
    fielders = [
        { x: width * 0.86, y: height * 0.525, isInfielder: true },
        { x: width * 0.5, y: height * 0.48, isInfielder: true },
        { x: width * 0.125, y: height * 0.52, isInfielder: true }
    ];

    // Additional fielders (non-infielders)
    for (let i = 3; i < 9; i++) {
        fielders.push({
            x: random(width * 0.11, width * 0.88),
            y: random(height * 0.5, height * 0.58),
            isInfielder: false
        });
    }


    initialFielderPositions = fielders.map(fielder => ({ x: fielder.x, y: fielder.y }));

    lineup = [batter];
    resetBall();

    fielders.forEach(fielder => {
        fielder.state = "idle";
    });

    settingButton = new Button("Settings", width - 80, 40, 120, 40, null, null, () => settingsClick());
    returnButton = new Button("Menu", width - 80, 90, 120, 40, null, null, () => returnToMenu());
    tempSwapPerspective = new Button("Perspective", width - 80, 140, 120, 40, null, null, () => togglePerspective());
    createModal();

    inputEnabled = true;
}

function draw() {
    background(50, 168, 82);
    image(bgImage, 0, 0, width, height);
    ballCaughtThisFrame = false;

    push();
    if (currentPerspective === "topDown") {
        background(34, 139, 34); // a solid green field
        drawTopDownField();
        drawTopDownPlayers();
    } else {
        // Your original side-view drawing
        background(50, 168, 82);
        image(bgImage, 0, 0, width, height);
        drawField();
        drawPlayers();
        if (batter) {
            stroke(255, 0, 0);
            strokeWeight(2);
            noFill();
            rectMode(CENTER);
            rect(batter.x, batter.y - 15, 30, 20);
        }
    }
    // draw hitzone
    pop();

    // Draw the HUD
    push();
    drawScoreboard();
    settingButton.display();
    returnButton.display();
    tempSwapPerspective.display();
    pop();

    push();
    if (showOutPopup) {
        drawOutPopup();
    }
    pop();

    // Game logic
    if (pitchAnimation) {
        pitcher.armAngle += 0.05;
        if (pitcher.armAngle > PI / 2) {
            pitchAnimation = false;
            ballMoving = true;
        }
    }

    if (ballMoving && !ballHit && !ball.throwing) {
        ball.y += ball.speedY;
        if (ball.y >= batter.y && abs(ball.x - batter.x) < hitZoneWidth && !swingAttempt) {
            ball.strikePitch = true;
            swingAttempt = true;

            strikes++;
            if (DEBUG) console.log("No swing! Strike " + strikes);
        }
    }

    if (ballMoving && !ball.throwing) {
        if (ballHit) {
            ball.x += ball.speedX;
            ball.y += ball.speedY;

            let gravity = windowHeight / 3000;
            if (ball.speedY < 0) {
                ball.speedY += gravity;
            } else {

                let horizontalDistance = ball.x - pitcher.x;
                let maxDistance = windowWidth * 0.6;

                let targetY = lerp(windowHeight * 0.5, windowHeight * 0.3, horizontalDistance / maxDistance);
                targetY = constrain(targetY, windowHeight * 0.3, windowHeight * 0.5);

                if (ball.y < targetY) {
                    ball.speedY += gravity;
                } else {
                    ball.y = lerp(ball.y, targetY, 0.1);
                    ball.speedY *= 0.9;

                    if (abs(ball.y - targetY) < catchDistance) {
                        ball.inAir = false;
                    }
                }
            }

            ball.speedX *= 0.98;

            if (abs(ball.speedX) < 0.3 && abs(ball.speedY) < 0.3) {
                ball.speedX = 0;
                ball.speedY = 0;
            }

            moveFieldersTowardsBall();
        }
        checkFielderCatch();
    }

    if (ball.throwing) {
        ball.x += ball.speedX;
        ball.y += ball.speedY;

        let targetFielder = ball.targetFielder;
        let advancingRunner = ball.advancingRunner;
        let targetRunner = getNearestUnsafedRunner(targetFielder);

        let chosenRunner = targetRunner || advancingRunner;

        if (!advancingRunner) {
            advancingRunner = targetRunner;
        }
        if (!chosenRunner) {
            console.error("No valid runner found! Stopping play.");
            ball.throwing = false;
            resetBatter();
            return;
        }

        if (targetFielder && dist(ball.x, ball.y, targetFielder.x, targetFielder.y) < catchDistance) {
            if (DEBUG) console.log(`Fielder targeting base ${chosenRunner.base + 1} catches the ball`);
            ball.throwing = false;


            if (targetFielder.isInfielder) {
                let runnerAtFielderBase = runners.find(runner => runner.base === chosenRunner.base);
                let baseVal = chosenRunner.base;

                let forwardFielder = getFielderForBase(baseVal + 1);
                let backtrackFielder = getFielderForBase(baseVal);

                if (runnerAtFielderBase && !runnerAtFielderBase.safe) {
                    if (!runnerAtFielderBase.backtracking && forwardFielder === targetFielder) {
                        outs++;
                        if (DEBUG) console.log("outs to", outs);
                        runners = runners.filter(r => r !== runnerAtFielderBase);
                        if (outs >= 3) {
                            nextInning();
                            return;
                        }
                        return;
                    } else if (runnerAtFielderBase.backtracking && backtrackFielder === targetFielder) {
                        outs++;
                        ball.throwing = false;
                        ball.caught = true;
                        resetBatter();
                        if (DEBUG) console.log("outs to", outs);
                        runners = runners.filter(r => r !== runnerAtFielderBase);
                        if (outs >= 3) {
                            nextInning();
                            return;
                        }
                        return;
                    }
                }
            }

            if (outs >= 3) {
                nextInning();
                return;
            }

            let targetRunner = getNearestUnsafedRunner(targetFielder);
            if (targetRunner) {
                if (DEBUG) console.log(`Throwing to next unsafe runner to base ${targetRunner.base + 1}`);
                handleGroundThrow(targetFielder);
            } else {
                resetBatter();
            }
        }
    }
    moveRunners();
}

function resetFieldersPosition() {
    fielders.forEach((fielder, index) => {
        fielder.x = initialFielderPositions[index].x;
        fielder.y = initialFielderPositions[index].y;
        fielder.state = "idle";
    });
}

function resetInfielders() {
    for (let i = 0; i < fielders.length; i++) {
        if (fielders[i].isInfielder) {
            fielders[i].x = initialFielderPositions[i].x;
            fielders[i].y = initialFielderPositions[i].y;
            fielders[i].state = "idle";
        }
    }
}

function handleStrikeCatch(catcher) {
    ball.x = catcher.x;
    ball.y = catcher.y;
    ball.speedY = 0;
    ball.speedX = 0;

    setTimeout(() => {
        resetBall();
        if (strikes >= 3) {
            outs++;
            resetBatter();
            if (DEBUG) console.log("Strikeout! Batter is out.");
            if (outs >= 3) {
                nextInning();
                return;
            }
        }
    }, 500);
}

function checkFielderCatch() {
    if (ballCaughtThisFrame) return;
    if (ball.caught) return;

    if (ball.strikePitch && dist(ball.x, ball.y, catcherPlayer.x, catcherPlayer.y) < strikeCatchThreshold) {
        catcherPlayer.state = "hasBall";
        handleStrikeCatch(catcherPlayer);
        ballCaughtThisFrame = true;
        return;
    }
    if (!ball.strikePitch && dist(ball.x, ball.y, catcherPlayer.x, catcherPlayer.y) < catchDistance) {
        catcherPlayer.state = "hasBall";

        if (ball.inAir) {
            handleThrow(catcherPlayer);
        } else {
            handleGroundThrow(catcherPlayer);
        }
        ballCaughtThisFrame = true;
        return;
    }


    if (!ballHit) return;
    for (let fielder of fielders) {
        if ((fielder.state === "idle" || fielder.state === "running") &&
            dist(ball.x, ball.y, fielder.x, fielder.y) < catchDistance) {
            // Fielder catches the ball:
            fielder.state = "hasBall";
            resetInfielders();
            if (ball.inAir) {
                // In-air catch
                handleThrow(fielder);
            } else {
                // Ground catch
                handleGroundThrow(fielder);
            }
            ballCaughtThisFrame = true;
            return;
        }
    }
}

function resetBall() {
    ball = {
        x: pitcher.x,
        y: pitcher.y,
        speedY: 5,
        speedX: 0,
        throwing: false,
        inAir: false,
        advancingRunner: null,
        strikePitch: false
    };
    ballMoving = false;
    ballHit = false;
    runners.forEach(runner => {
        runner.safe = false;
    });
}

function drawTopDownField() {
    // Draw the diamond
    stroke(255);
    strokeWeight(2);
    noFill();
    beginShape();
    vertex(bases[0].x, bases[0].y); // Home plate
    vertex(bases[1].x, bases[1].y); // First base
    vertex(bases[2].x, bases[2].y); // Second base
    vertex(bases[3].x, bases[3].y); // Third base
    endShape(CLOSE);

    // Draw each base 
    fill(255);
    noStroke();
    for (let base of bases) {
        ellipse(base.x, base.y, 20, 20);
    }
}

function drawTopDownPlayers() {
    fill('red');
    ellipse(pitcher.x, pitcher.y, 15, 15);

    if (batter) {
        fill('orange');
        ellipse(batter.x, batter.y, 15, 15);
    }

    fill('blue');
    ellipse(catcherPlayer.x, catcherPlayer.y, 15, 15);

    fill('purple');
    for (let fielder of fielders) {
        ellipse(fielder.x, fielder.y, 15, 15);
    }

    fill('yellow');
    for (let runner of runners) {
        ellipse(runner.x, runner.y, 15, 15);
    }

    fill('white');
    ellipse(ball.x, ball.y, 10, 10);
}

function drawField() {
    fill(255);
    bases.forEach(base => {
        rect(base.x - 10, base.y - 10, 20, 20);
    });

    stroke(255);
    noFill();
    beginShape();
    bases.forEach(base => vertex(base.x, base.y));
    vertex(bases[0].x, bases[0].y);
    endShape();
}

function drawPlayers() {
    fielders.forEach(fielder => {
        if (fielder.state === "running") {
            image(fielderRunningGif, fielder.x - PLAYER_OFFSET_X, fielder.y - PLAYER_OFFSET_Y, PLAYER_WIDTH, PLAYER_HEIGHT);
        } else {
            image(fielderIdleGif, fielder.x - PLAYER_OFFSET_X, fielder.y - PLAYER_OFFSET_Y, PLAYER_WIDTH, PLAYER_HEIGHT);
        }
    });

    runners.forEach(runner => {
        if (runner.running) {
            image(runnerRunningGif, runner.x - PLAYER_OFFSET_X, runner.y - PLAYER_OFFSET_Y, PLAYER_WIDTH, PLAYER_HEIGHT);
        } else {
            image(runnerIdle, runner.x - PLAYER_OFFSET_X, runner.y - PLAYER_OFFSET_Y, PLAYER_WIDTH, PLAYER_HEIGHT);
        }
    });

    drawPlayer(pitcher, 'red');

    if (batter) {
        image(batterGif, batter.x - PLAYER_OFFSET_X, batter.y - PLAYER_OFFSET_Y, PLAYER_WIDTH, PLAYER_HEIGHT);
    }

    drawPlayer(catcherPlayer, 'blue');

    fill(255);
    ellipse(ball.x, ball.y, 10, 10);
}

function drawPlayer(player, color) {

    if (player === pitcher) {
        image(fielderIdleGif, player.x - PLAYER_OFFSET_X, player.y - PLAYER_OFFSET_Y, PLAYER_WIDTH, PLAYER_HEIGHT);
        return;
    }
    if (player === batter) {
        image(batterGif, player.x - PLAYER_OFFSET_X, player.y - PLAYER_OFFSET_Y, PLAYER_WIDTH, PLAYER_HEIGHT);
        return;
    }
    if (player === catcherPlayer) {
        image(catcherImg, player.x - PLAYER_OFFSET_X, player.y - PLAYER_OFFSET_Y, PLAYER_WIDTH, PLAYER_HEIGHT);
        return;
    }
    fill(color);
    ellipse(player.x, player.y - 15, 20, 20);
    fill(0);
    rect(player.x - 5, player.y, 10, 20);
}

function drawScoreboard() {
    fill(0);
    rect(20, 20, 190, 90);
    fill(255);
    textSize(14);
    text(`Inning: ${inning} ${topInning ? '▲' : '▼'}`, 30, 40);
    text(`Score - Home: ${score.home}  Away: ${score.away}`, 30, 60);
    text(`Outs: ${outs}`, 30, 80);
    text(`Strikes: ${strikes}`, 30, 100);
}

function moveRunners() {
    runners = runners.filter(runner => {
        if (runner.running) {
            let targetIndex = runner.base + 1;
            if (runner.backtracking) {
                targetIndex = runner.base;
            }
            let targetBase = bases[targetIndex % 4];

            if (runner.x < targetBase.x) runner.x += runner.speed;
            if (runner.x > targetBase.x) runner.x -= runner.speed;
            if (runner.y < targetBase.y) runner.y += runner.speed;
            if (runner.y > targetBase.y) runner.y -= runner.speed;

            if (dist(runner.x, runner.y, targetBase.x, targetBase.y) < 5) {
                runner.x = targetBase.x;
                runner.y = targetBase.y;

                if (runner.backtracking) {
                    runner.running = false;
                    runner.backtracking = false;
                    runner.safe = true;
                } else {
                    runner.base++;
                    if (runner.base >= 4) {
                        score[topInning ? 'away' : 'home']++;
                        if (DEBUG) console.log(`Runner scored! Updated Score - Home: ${score.home}, Away: ${score.away}`);
                        return false;
                    } else {
                        runner.running = false;
                        runner.safe = true;
                        if (DEBUG) console.log(`Runner reached base ${runner.base} and is holding.`);
                    }
                }
            }
        }
        return true;
    });
}

function moveFieldersTowardsBall() {
    let closestFielder = null;
    let minDistance = Infinity;

    for (let fielder of fielders) {
        let d = dist(fielder.x, fielder.y, ball.x, ball.y);
        if (d < minDistance) {
            minDistance = d;
            closestFielder = fielder;
        }
    }

    if (closestFielder) {
        let angleToBall = atan2(ball.y - closestFielder.y, ball.x - closestFielder.x);
        let speed = 2;

        let newX = closestFielder.x + cos(angleToBall) * speed;
        let newY = closestFielder.y + sin(angleToBall) * speed;

        if ((closestFielder.y <= height * 0.42) && (ball.y <= height * 0.42)) {
            newY = closestFielder.y; // Stop moving up/down
        }

        closestFielder.x = newX;
        closestFielder.y = newY;

        if (dist(closestFielder.x, closestFielder.y, ball.x, ball.y) > catchDistance) {
            closestFielder.state = "running";
        } else {
            closestFielder.state = "idle";
        }
    }

    fielders.forEach(fielder => {
        if (fielder !== closestFielder) {
            let d = dist(fielder.x, fielder.y, ball.x, ball.y);
            if (d > catchingRadius) {
                fielder.state = "idle";
            }
        }
    });
}

function isWithinCatchingArea(fielder) {
    return dist(fielder.x, fielder.y, ball.x, ball.y) < catchingRadius;
}

function getClosestFielderToBase(runner) {
    if (!runner) {
        console.error("getClosestFielderToBase received a null runner");
        return null;
    }
    let targetBase = bases[(runner.base + 1) % 4];
    let closest = null;
    let minDist = Infinity;
    for (let fielder of fielders) {
        let d = dist(fielder.x, fielder.y, targetBase.x, targetBase.y);
        if (d < minDist) {
            minDist = d;
            closest = fielder;
        }
    }
    return closest;
}

function handleGroundThrow(catcher) {
    ball.throwingFielder = catcher;
    ball.wasAirCatch = false;

    let unsafeRunners = runners.filter(runner => !runner.safe);
    if (unsafeRunners.length > 0) {
        throwToNextRunner(catcher);
        return;
    }

    if (DEBUG) console.log("No unsafe runners left, resetting the play.");
    resetBatter();
    resetFieldersPosition();
}


function handleThrow(catcher) {
    ball.throwingFielder = catcher;
    ball.wasAirCatch = true;
    ball.caught = true;

    let batterOut = ball.advancingRunner;
    if (batterOut) {
        if (DEBUG) console.log("Air catch");
        runners = runners.filter(runner => runner !== batterOut);
        if (!showOutPopup) {
            outs++;
        }
        if (DEBUG) console.log(`outs to ${outs}`);
        if (outs >= 3) {
            setTimeout(() => {
                nextInning();
            }, 50);
        }
    } else {
        console.error("No advancing runner found for air catch!");
        return;
    }

    let runnerFirstToSecond = runners.find(r => r.base === 1 && r.running);
    if (runnerFirstToSecond && shouldBacktrack(runnerFirstToSecond)) {
        runnerFirstToSecond.backtracking = true;
    }

    // Check for any remaining unsafe runners
    let unsafeRunners = runners.filter(runner => !runner.safe);

    if (unsafeRunners.length > 0) {
        throwToNextRunner(catcher);
        return;
    }

    // If no unsafe runners left, reset the play
    if (DEBUG) console.log("No unsafe runners left, resetting the play.");
    resetBatter();
}

function shouldBacktrack(runner) {
    let currentBase = bases[runner.base];
    let nextBase = bases[(runner.base + 1) % bases.length];
    let totalDistance = dist(currentBase.x, currentBase.y, nextBase.x, nextBase.y);
    let runnerDistance = dist(currentBase.x, currentBase.y, runner.x, runner.y);
    return runnerDistance < totalDistance / 2;
}

function throwToNextRunner(currentFielder) {
    let nextRunner = getNearestUnsafedRunner(currentFielder);
    if (!nextRunner) {
        if (DEBUG) console.log("No more unsafe runners left.");
        resetBatter();
        return;
    }

    let tBase = nextRunner.base;
    const targetBaseIndex = nextRunner.backtracking ? tBase : (tBase + 1) % 4;

    let targetBase = bases[targetBaseIndex];
    let targetFielder = getFielderForBase(targetBaseIndex);

    if (!nextRunner.safe && targetFielder === currentFielder && !nextRunner.backtracking) {
        outs++;
        if (DEBUG) console.log("outs is now", outs);
        runners = runners.filter(r => r !== nextRunner);
        if (outs >= 3) {
            nextInning();
            return;
        }
        handleGroundThrow(targetFielder);
        return;
    }

    nextRunner = getNearestUnsafedRunner(currentFielder);
    if (!nextRunner) {
        if (DEBUG) console.log("No more unsafe runners left.");
        resetBatter();
        return;
    }
    if (!targetFielder) {
        if (DEBUG) console.log("targetfielder returned null");
        targetFielder = getClosestFielderToBase(nextRunner);
    }

    // Set ball trajectory to throw to the next fielder
    ball.x = currentFielder.x;
    ball.y = currentFielder.y;

    let dx = targetFielder.x - currentFielder.x;
    let dy = targetFielder.y - currentFielder.y;
    let magnitude = sqrt(dx * dx + dy * dy);

    ball.speedX = (dx / magnitude) * 10;
    ball.speedY = (dy / magnitude) * 10;

    ball.advancingRunner = nextRunner;
    ball.targetFielder = targetFielder;
    ball.targetBase = targetBase;
    ball.throwing = true;
    currentFielder.state = "throwing";
}

function getNearestUnsafedRunner(catcher) {
    let targetRunner = null;
    let minDistance = Infinity;
    for (let runner of runners) {

        if (runner.safe || !runner.running) {
            continue;
        }
        if (!runners.includes(runner)) { continue; }

        let targetBaseIndex = (runner.base + 1) % bases.length;
        let targetBase = bases[targetBaseIndex];
        let d = dist(catcher.x, catcher.y, targetBase.x, targetBase.y);
        if (d < minDistance) {
            minDistance = d;
            targetRunner = runner;
        }
    }
    return targetRunner;
}


function getFielderForBase(baseIndex) {
    // Map: base 1 → fielders[0], base 2 → fielders[1], base 3 → fielders[2]
    if (baseIndex === 0 || baseIndex === 4) return catcherPlayer;
    if (baseIndex === 1) return fielders[0];
    if (baseIndex === 2) return fielders[1];
    if (baseIndex === 3) return fielders[2];
    return null;
}

function nextInning() {
    inputEnabled = false;
    outs = 0;
    runners = [];
    resetFieldersPosition()
    if (!topInning) inning++;
    topInning = !topInning;

    showOutPopup = true;
    resetBatter();
    runners = [];

    setTimeout(() => {
        showOutPopup = false;
        inputEnabled = true;
    }, 1500);

}

function keyPressed() {
    if (key === ' ') {
        // Start pitch
        if (!ballMoving && inputEnabled) {
            pitchAnimation = true;
            swingAttempt = false;
        } else if (ballMoving && !ballHit && !swingAttempt && inputEnabled) {
            if (ball.y >= batter.y - hitZoneHeight && ball.y <= batter.y && abs(ball.x - batter.x) < hitZoneWidth * 0.5) {
                // Successful swing/hit.
                ballHit = true;
                ball.inAir = true;
                playSoundEffect("hitBall");

                let xPower = windowWidth / 200;
                let yPower = windowHeight / 200;
                ball.speedX = random(-xPower * 0.8, xPower * 0.8);
                ball.speedY = random(-yPower * 4.5, -yPower * 4.0);

                batter.running = true;
                runners.forEach(runner => {
                    runner.running = true;
                });
                runners.push(batter);
                ball.advancingRunner = batter;
                batter = null;
            } else {
                ball.strikePitch = true;

                strikes++;
                if (DEBUG) console.log("Swing missed! Strike " + strikes);
            }
            swingAttempt = true;
        }
    }
}

function resetBatter() {
    if (!batter) {
        batter = {
            x: width * 0.5,
            y: height * 0.80,
            running: false,
            speed: 4,
            base: 0,
            safe: false,
            backtracking: false
        };
        lineup[currentBatter % lineup.length] = batter;
        currentBatter++;
    }
    strikes = 0;
    resetBall();
    resetFieldersPosition();
}

function drawOutPopup() {
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(64);
    text("3 Outs!\nSwitching Sides", width / 2, height * 0.2);
}

function loadVolumeSetting() {
    const savedVolume = localStorage.getItem("volume");
    const savedMute = localStorage.getItem("isMuted");
    const savedEffectsVolume = localStorage.getItem("effectsVolume");

    if (savedVolume !== null) {
        currVolume = parseFloat(savedVolume);
    }
    if (savedEffectsVolume !== null) {
        currEffectsVolume = parseFloat(savedEffectsVolume);
    }
    if (savedMute !== null) {
        let isMuted = savedMute === "true";
        if (currSong) {
            currSong.setVolume(isMuted ? 0 : currVolume);
        }
        Object.values(soundEffects).forEach((sound) => {
            sound.setVolume(isMuted ? 0 : currEffectsVolume);
        });

    }
}

function mousePressed() {
    if (!settingMenu) {
        if (settingButton.isHovered()) {
            buttonClick();
            setTimeout(() => settingButton.action(), 200);
        }
        if (returnButton.isHovered()) {
            buttonClick();
            setTimeout(() => returnButton.action(), 200);
        }
        if (tempSwapPerspective.isHovered()) {
            buttonClick();
            setTimeout(() => tempSwapPerspective.action(), 200);
        }
    }
    if (!currSong.isPlaying()) {
        currSong.loop();
    }
}

function togglePerspective() {
    currentPerspective = currentPerspective === "side" ? "topDown" : "side";
}
function settingsClick() {
    settingMenu = true;
    showSettings();
}
function buttonClick() {
    playSoundEffect("buttonSound");
}

function returnToMenu() {
    localStorage.setItem("gameState", "menu");
    window.location.href = "index.html";
}