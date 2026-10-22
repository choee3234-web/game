"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import confetti from "canvas-confetti";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Music,
  Heart,
  Clock,
  Sparkles,
  Trophy,
  ArrowRight,
  ShieldAlert,
  Flame,
  Settings,
  Sun,
  Moon,
  Smartphone,
} from "lucide-react";
import { Brick, BrickColor, GameState, LeaderboardEntry } from "@/types/game";
import { soundManager } from "@/lib/sound";
import { LeaderboardCard } from "./LeaderboardCard";
import { GoogleSheetSettingsModal } from "./GoogleSheetSettingsModal";

// 캔버스 크기 (정사각형)
const CANVAS_WIDTH = 560;
const CANVAS_HEIGHT = 560;

// 블록 설정 (5행 × 8열 = 40개)
const ROWS = 5;
const COLS = 8;
const BRICK_HEIGHT = 22;
const BRICK_GAP_X = 6;
const BRICK_GAP_Y = 8;
const PADDING_TOP = 55;
const PADDING_SIDE = 22;

// 가로 블록 너비 계산: (560 - 44 - (7 * 6)) / 8 = 474 / 8 = 59.25px
const BRICK_WIDTH = (CANVAS_WIDTH - PADDING_SIDE * 2 - (COLS - 1) * BRICK_GAP_X) / COLS;

// 블록 색상 정의
const COLOR_MAP: Record<BrickColor, { hex: string; label: string }> = {
  "light-red": { hex: "#FF8A8A", label: "연한 빨강" },
  "light-orange": { hex: "#FFB677", label: "연한 주황" },
  "light-yellow": { hex: "#FEE073", label: "연한 노랑" },
  "light-blue": { hex: "#7ECBFF", label: "연한 파랑" },
  "light-green": { hex: "#8EE296", label: "연한 녹색" },
  "light-purple": { hex: "#D4A5FF", label: "연한 보라" },
};

export default function InuBreakoutGame() {
  // 테마 (라이트/다크모드)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const isDarkRef = useRef<boolean>(false);

  // 게임 상태 관리
  const [gameState, setGameState] = useState<GameState>("INIT");
  const [playerName, setPlayerName] = useState<string>("");
  const [lives, setLives] = useState<number>(3);
  const [redDestroyed, setRedDestroyed] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [bgmPlaying, setBgmPlaying] = useState<boolean>(false);

  // 명예의 전당 & 설정 모달
  const [top3, setTop3] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [lastClearTime, setLastClearTime] = useState<string>("");
  const [lastRank, setLastRank] = useState<number | null>(null);

  // 캔버스 및 물리 참조값
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const respawnTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 물리 엔티티 상태 (렌더 루프 내부에서 즉각 접근)
  const paddleRef = useRef({
    x: (CANVAS_WIDTH - 100) / 2,
    y: CANVAS_HEIGHT - 32,
    width: 100,
    height: 14,
    speed: 550, // 초당 픽셀 이동
  });

  const ballRef = useRef({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 48,
    radius: 7.5,
    vx: 0,
    vy: 0,
    speed: 380,
    attached: true,
  });

  const bricksRef = useRef<Brick[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const gameStartTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const redCountRef = useRef<number>(0);

  // 1. 다크모드 초기화 및 동기화
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem("inu_theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initialDark = storedTheme ? storedTheme === "dark" : prefersDark;
      setIsDarkMode(initialDark);
      isDarkRef.current = initialDark;
      document.documentElement.classList.toggle("dark", initialDark);
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    isDarkRef.current = nextDark;
    document.documentElement.classList.toggle("dark", nextDark);
    localStorage.setItem("inu_theme", nextDark ? "dark" : "light");
  };

  // 2. 명예의 전당 데이터 불러오기
  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoadingLeaderboard(true);
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        if (data.top3) {
          setTop3(data.top3);
        }
      }
    } catch (err) {
      console.error("명예의 전당 조회 오류:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // 3. BGM 오디오 객체 초기화 (볼륨 0.15로 너무 크지 않게 설정)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const audio = new Audio("/Hyper_Speed_Run.mp3");
      audio.loop = true;
      audio.volume = 0.15; // 적절하고 편안한 볼륨
      bgmRef.current = audio;

      return () => {
        audio.pause();
        audio.src = "";
      };
    }
  }, []);

  // BGM 재생 함수
  const startBgm = useCallback(() => {
    if (!bgmRef.current || soundManager.isMuted) return;
    bgmRef.current.volume = 0.15;
    bgmRef.current
      .play()
      .then(() => {
        setBgmPlaying(true);
      })
      .catch((e) => {
        console.log("BGM 자동 재생 대기 (사용자 제스처 필요):", e);
      });
  }, []);

  // BGM 정지 및 초기화 함수 (메인 페이지 등에서 완전 정지)
  const stopBgm = useCallback(() => {
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
    }
    setBgmPlaying(false);
  }, []);

  // 메인 화면(INIT, INPUT_NAME)일 때는 BGM을 사용하지 않도록 보장
  useEffect(() => {
    if (gameState === "INIT" || gameState === "INPUT_NAME") {
      stopBgm();
    }
  }, [gameState, stopBgm]);

  const toggleBgm = () => {
    if (!bgmRef.current) return;
    if (bgmPlaying) {
      bgmRef.current.pause();
      setBgmPlaying(false);
    } else {
      bgmRef.current.volume = 0.15;
      bgmRef.current
        .play()
        .then(() => {
          setBgmPlaying(true);
        })
        .catch((e) => console.log("BGM 재생 오류:", e));
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    soundManager.isMuted = nextMute;
    if (nextMute && bgmPlaying) {
      bgmRef.current?.pause();
      setBgmPlaying(false);
    } else if (!nextMute && ["COUNTDOWN", "PLAYING", "BALL_RESET"].includes(gameState)) {
      startBgm();
    }
  };

  // 4. 벽돌 그리드 초기화 (40개 중 연한 빨강 정확히 30% = 12개 배치)
  const initBricks = useCallback(() => {
    const totalBricks = ROWS * COLS; // 40
    const redCount = Math.round(totalBricks * 0.3); // 12개
    const otherColors: BrickColor[] = [
      "light-orange",
      "light-yellow",
      "light-blue",
      "light-green",
      "light-purple",
    ];

    const colorList: BrickColor[] = [];
    for (let i = 0; i < redCount; i++) {
      colorList.push("light-red");
    }
    const remaining = totalBricks - redCount; // 28개
    for (let i = 0; i < remaining; i++) {
      const randomColor = otherColors[i % otherColors.length];
      colorList.push(randomColor);
    }

    // Fisher-Yates 셔플
    for (let i = colorList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [colorList[i], colorList[j]] = [colorList[j], colorList[i]];
    }

    const bricks: Brick[] = [];
    let idx = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = colorList[idx];
        const isRed = color === "light-red";
        bricks.push({
          id: idx,
          x: PADDING_SIDE + c * (BRICK_WIDTH + BRICK_GAP_X),
          y: PADDING_TOP + r * (BRICK_HEIGHT + BRICK_GAP_Y),
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          colorType: color,
          colorHex: COLOR_MAP[color].hex,
          isRed,
          broken: false,
        });
        idx++;
      }
    }

    bricksRef.current = bricks;
  }, []);

  // 5. 패들 & 공 초기 위치 리셋
  const resetPaddleAndBall = useCallback((attached: boolean = true) => {
    paddleRef.current.x = (CANVAS_WIDTH - paddleRef.current.width) / 2;
    ballRef.current.x = CANVAS_WIDTH / 2;
    ballRef.current.y = paddleRef.current.y - ballRef.current.radius - 1;
    ballRef.current.attached = attached;

    if (!attached) {
      const angle = (Math.random() * 0.4 - 0.2) * Math.PI; // -36° ~ +36°
      const speed = ballRef.current.speed;
      ballRef.current.vx = speed * Math.sin(angle);
      ballRef.current.vy = -speed * Math.cos(angle);
    } else {
      ballRef.current.vx = 0;
      ballRef.current.vy = 0;
    }
  }, []);

  // 6. 공 발사 함수 (대기 상태에서 공을 날림)
  const launchAttachedBall = useCallback(() => {
    if (!ballRef.current.attached) return;
    if (respawnTimeoutRef.current) {
      clearTimeout(respawnTimeoutRef.current);
      respawnTimeoutRef.current = null;
    }
    ballRef.current.attached = false;
    const angle = (Math.random() * 0.4 - 0.2) * Math.PI;
    const speed = ballRef.current.speed;
    ballRef.current.vx = speed * Math.sin(angle);
    ballRef.current.vy = -speed * Math.cos(angle);
    setGameState("PLAYING");
  }, []);

  // 7. 밀리초 포맷팅 함수 (MM:SS.ss)
  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  };

  // 8. 키보드 이벤트 리스너 (방향키 ←, →)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(e.code)) {
        keysPressed.current[e.code] = true;
        e.preventDefault();
      }
      if (e.code === "Space") {
        if (ballRef.current.attached && (gameState === "PLAYING" || gameState === "BALL_RESET")) {
          launchAttachedBall();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(e.code)) {
        keysPressed.current[e.code] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState, launchAttachedBall]);

  // 9. 모바일 터치 / 스와이프 조작 처리
  const handleTouchPaddleMove = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const touchCanvasX = (clientX - rect.left) * scaleX;

    const paddle = paddleRef.current;
    paddle.x = Math.max(
      0,
      Math.min(CANVAS_WIDTH - paddle.width, touchCanvasX - paddle.width / 2)
    );
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      handleTouchPaddleMove(e.touches[0].clientX);
      // 공이 붙어있을 때 터치로 발사
      if (ballRef.current.attached && (gameState === "PLAYING" || gameState === "BALL_RESET")) {
        launchAttachedBall();
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      handleTouchPaddleMove(e.touches[0].clientX);
    }
  };

  // 10. 미션 성공 처리
  const handleMissionSuccess = useCallback(async () => {
    setGameState("SUCCESS");
    if (animFrameId.current) cancelAnimationFrame(animFrameId.current);

    // BGM 정지
    bgmRef.current?.pause();
    setBgmPlaying(false);

    const clearMs = Date.now() - gameStartTimeRef.current;
    const formatted = formatTime(clearMs);
    setLastClearTime(formatted);

    soundManager.playVictoryFanfare();

    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.6 },
    });
    setTimeout(() => {
      confetti({
        particleCount: 100,
        angle: 60,
        spread: 60,
        origin: { x: 0.1, y: 0.65 },
      });
    }, 250);
    setTimeout(() => {
      confetti({
        particleCount: 100,
        angle: 120,
        spread: 60,
        origin: { x: 0.9, y: 0.65 },
      });
    }, 500);

    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playerName.trim() || "익명의 횃불이",
          timeInSeconds: clearMs / 1000,
          timeFormatted: formatted,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.rank) setLastRank(data.rank);
        if (data.top3) setTop3(data.top3);
      }

      // [구글 앱스 스크립트 실행] .env.local의 NEXT_PUBLIC_GOOGLE_SCRIPT_URL 우선 적용
      const googleScriptUrl =
        process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL ||
        (typeof window !== "undefined"
          ? localStorage.getItem("inu_google_sheet_webhook") || ""
          : "");

      if (googleScriptUrl) {
        fetch(googleScriptUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timestamp: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
            name: playerName.trim() || "익명의 횃불이",
            finishtime: formatted,
          }),
        }).catch((e) => console.log("클라이언트 구글 앱스 스크립트 전송:", e));
      }
    } catch (err) {
      console.error("기록 저장 중 오류:", err);
    }
  }, [playerName]);

  // 11. 게임 루프 (Canvas Render & Physics)
  const runGameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      // 실시간 타이머 갱신
      if (gameStartTimeRef.current > 0) {
        setElapsedMs(Date.now() - gameStartTimeRef.current);
      }

      // 1. 패들 이동 (방향키 ←, →)
      const paddle = paddleRef.current;
      const leftKey = keysPressed.current["ArrowLeft"] || keysPressed.current["KeyA"];
      const rightKey = keysPressed.current["ArrowRight"] || keysPressed.current["KeyD"];

      if (leftKey) {
        paddle.x -= paddle.speed * dt;
      }
      if (rightKey) {
        paddle.x += paddle.speed * dt;
      }

      if (paddle.x < 0) paddle.x = 0;
      if (paddle.x + paddle.width > CANVAS_WIDTH) {
        paddle.x = CANVAS_WIDTH - paddle.width;
      }

      // 2. 공 이동 & 물리 계산
      const ball = ballRef.current;
      if (ball.attached) {
        ball.x = paddle.x + paddle.width / 2;
        ball.y = paddle.y - ball.radius - 1;
      } else {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // 좌/우 벽 충돌
        if (ball.x - ball.radius <= 0) {
          ball.x = ball.radius;
          ball.vx = -ball.vx;
          soundManager.playWallSound();
        } else if (ball.x + ball.radius >= CANVAS_WIDTH) {
          ball.x = CANVAS_WIDTH - ball.radius;
          ball.vx = -ball.vx;
          soundManager.playWallSound();
        }

        // 상단 벽 충돌
        if (ball.y - ball.radius <= 0) {
          ball.y = ball.radius;
          ball.vy = -ball.vy;
          soundManager.playWallSound();
        }

        // 패들 충돌
        if (
          ball.y + ball.radius >= paddle.y &&
          ball.y - ball.radius <= paddle.y + paddle.height &&
          ball.x >= paddle.x &&
          ball.x <= paddle.x + paddle.width &&
          ball.vy > 0
        ) {
          const hitOffset = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
          const maxBounceAngle = (5 * Math.PI) / 12;
          const bounceAngle = hitOffset * maxBounceAngle;

          const currentSpeed = Math.hypot(ball.vx, ball.vy);
          ball.vx = currentSpeed * Math.sin(bounceAngle);
          ball.vy = -currentSpeed * Math.cos(bounceAngle);
          ball.y = paddle.y - ball.radius - 1;

          soundManager.playPaddleSound();
        }

        // 벽돌 충돌 검사
        const bricks = bricksRef.current;
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i];
          if (b.broken) continue;

          const closestX = Math.max(b.x, Math.min(ball.x, b.x + b.width));
          const closestY = Math.max(b.y, Math.min(ball.y, b.y + b.height));
          const distX = ball.x - closestX;
          const distY = ball.y - closestY;
          const distSquared = distX * distX + distY * distY;

          if (distSquared < ball.radius * ball.radius) {
            b.broken = true;

            const overlapX = ball.radius - Math.abs(distX);
            const overlapY = ball.radius - Math.abs(distY);

            if (overlapX < overlapY) {
              ball.vx = -ball.vx;
            } else {
              ball.vy = -ball.vy;
            }

            soundManager.playBrickSound(b.isRed);

            if (b.isRed) {
              redCountRef.current += 1;
              const newCount = redCountRef.current;
              setRedDestroyed(newCount);

              if (newCount >= 3) {
                handleMissionSuccess();
                return;
              }
            }
            break;
          }
        }

        // [중요] 공이 패들 하단으로 떨어졌을 때: 생명 차감 및 새로운 공 즉각 리스폰
        if (ball.y - ball.radius > CANVAS_HEIGHT) {
          soundManager.playLifeLostSound();

          setLives((prev) => {
            const nextLives = prev - 1;
            if (nextLives <= 0) {
              setGameState("FAILED");
              bgmRef.current?.pause();
              setBgmPlaying(false);
              if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
            } else {
              // 생명이 남아있을 경우: 새로운 공을 패들에 즉시 배치하여 대기
              setGameState("BALL_RESET");
              ball.attached = true;
              ball.vx = 0;
              ball.vy = 0;
              ball.x = paddle.x + paddle.width / 2;
              ball.y = paddle.y - ball.radius - 1;

              // 1.5초 후 자동 발사 타이머 (이전에 화면 터치/스페이스바 누르면 즉시 발사)
              if (respawnTimeoutRef.current) clearTimeout(respawnTimeoutRef.current);
              respawnTimeoutRef.current = setTimeout(() => {
                launchAttachedBall();
              }, 1500);
            }
            return nextLives;
          });
        }
      }

      // 3. 캔버스 렌더링 (다크모드 지원)
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const isDark = isDarkRef.current;

      // 배경 색상
      ctx.fillStyle = isDark ? "#0B132B" : "#F8FAFC";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 배경 도트 그리드 장식
      ctx.fillStyle = isDark ? "#1E293B" : "#E2E8F0";
      for (let gx = 20; gx < CANVAS_WIDTH; gx += 30) {
        for (let gy = 20; gy < CANVAS_HEIGHT; gy += 30) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 벽돌 그리기
      const bricks = bricksRef.current;
      for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        if (b.broken) continue;

        const radius = 4;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.width, b.height, radius);
        ctx.fillStyle = b.colorHex;
        ctx.fill();

        ctx.lineWidth = 1.2;
        ctx.strokeStyle = b.isRed
          ? isDark ? "#FF6B6B" : "#FF4D4D"
          : isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.7)";
        ctx.stroke();

        if (b.isRed) {
          ctx.fillStyle = isDark ? "#FFE4E6" : "#D62828";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("★", b.x + b.width / 2, b.y + b.height / 2);
        }

        ctx.restore();
      }

      // 패들 그리기 (INU 시그니처 블루 + 하이라이트)
      ctx.save();
      const pGrad = ctx.createLinearGradient(
        paddle.x,
        paddle.y,
        paddle.x,
        paddle.y + paddle.height
      );
      if (isDark) {
        pGrad.addColorStop(0, "#38BDF8");
        pGrad.addColorStop(1, "#1D4ED8");
        ctx.shadowColor = "rgba(56, 189, 248, 0.4)";
      } else {
        pGrad.addColorStop(0, "#3B82F6");
        pGrad.addColorStop(1, "#1D4ED8");
        ctx.shadowColor = "rgba(29, 78, 216, 0.3)";
      }
      ctx.fillStyle = pGrad;
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 7);
      ctx.fill();
      ctx.restore();

      // 공 그리기
      ctx.save();
      const bGrad = ctx.createRadialGradient(
        ball.x - 2,
        ball.y - 2,
        1,
        ball.x,
        ball.y,
        ball.radius
      );
      bGrad.addColorStop(0, "#FFFFFF");
      bGrad.addColorStop(0.3, "#FF6B6B");
      bGrad.addColorStop(1, "#EE5253");
      ctx.fillStyle = bGrad;
      ctx.shadowColor = isDark ? "rgba(255, 107, 107, 0.6)" : "rgba(238, 82, 83, 0.4)";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      animFrameId.current = requestAnimationFrame(loop);
    };

    animFrameId.current = requestAnimationFrame(loop);
  }, [handleMissionSuccess, launchAttachedBall]);

  // 12. 카운트다운 진행 및 BGM 자동 시작
  const startCountdown = useCallback(() => {
    setGameState("COUNTDOWN");
    setCountdownNum(3);
    soundManager.playCountdownBeep(false);

    let current = 3;
    const interval = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdownNum(current);
        soundManager.playCountdownBeep(false);
      } else if (current === 0) {
        setCountdownNum(0); // "START!"
        soundManager.playCountdownBeep(true);
      } else {
        clearInterval(interval);
        // 인게임 진입 및 BGM 자동 재생 시작
        setGameState("PLAYING");
        gameStartTimeRef.current = Date.now();
        resetPaddleAndBall(false);
        startBgm();
        runGameLoop();
      }
    }, 1000);
  }, [resetPaddleAndBall, runGameLoop, startBgm]);

  // 시작 버튼 클릭 (초반 화면 -> 이름 입력 화면)
  const handleStartButtonClick = () => {
    setGameState("INPUT_NAME");
  };

  // 이름 작성 후 도전 시작
  const handleConfirmNameAndStart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!playerName.trim()) {
      alert("플레이어 이름을 입력해 주세요!");
      return;
    }

    setLives(3);
    setRedDestroyed(0);
    redCountRef.current = 0;
    setElapsedMs(0);
    initBricks();
    resetPaddleAndBall(true);
    startCountdown();
  };

  // 일시 정지 / 계속하기 토글
  const handleTogglePause = () => {
    if (gameState === "PLAYING") {
      setGameState("PAUSED");
      pausedAtRef.current = Date.now();
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      bgmRef.current?.pause();
      setBgmPlaying(false);
    } else if (gameState === "PAUSED") {
      const pauseDuration = Date.now() - pausedAtRef.current;
      gameStartTimeRef.current += pauseDuration;
      setGameState("PLAYING");
      if (!isMuted) startBgm();
      runGameLoop();
    }
  };

  // 다시 시작 버튼 클릭 (이름을 작성하는 첫 화면으로 이동 & BGM 정지)
  const handleRestartToNameScreen = () => {
    if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    if (respawnTimeoutRef.current) clearTimeout(respawnTimeoutRef.current);
    stopBgm();
    setGameState("INPUT_NAME");
    setLives(3);
    setRedDestroyed(0);
    redCountRef.current = 0;
    setElapsedMs(0);
    resetPaddleAndBall(true);
  };

  // 동일한 이름으로 재도전
  const handleRetrySameName = () => {
    if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    if (respawnTimeoutRef.current) clearTimeout(respawnTimeoutRef.current);
    setLives(3);
    setRedDestroyed(0);
    redCountRef.current = 0;
    setElapsedMs(0);
    initBricks();
    resetPaddleAndBall(true);
    startCountdown();
  };

  // 마운트 시 브릭 초기화
  useEffect(() => {
    initBricks();
    resetPaddleAndBall(true);
  }, [initBricks, resetPaddleAndBall]);

  // 언마운트 시 클린업
  useEffect(() => {
    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      if (respawnTimeoutRef.current) clearTimeout(respawnTimeoutRef.current);
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-sky-50 via-blue-50/40 to-indigo-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-zinc-950 flex flex-col items-center justify-between p-3 sm:p-6 text-slate-800 dark:text-slate-100 select-none transition-colors duration-200">
      <div className="w-full max-w-[560px] flex flex-col items-center">
        {/* 글로벌 상단 컨트롤 바 */}
        <div className="w-full flex items-center justify-between mb-3 px-1 sm:px-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 dark:text-blue-300 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs px-3 py-1.5 rounded-full border border-blue-100 dark:border-slate-800 shadow-xs">
            <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span className="hidden xs:inline">INU 벽돌깨기</span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">v1.2</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 라이트 / 다크모드 토글 버튼 */}
            <button
              onClick={toggleDarkMode}
              title={isDarkMode ? "라이트 모드로 변경" : "다크 모드로 변경"}
              className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 border border-slate-200/80 dark:border-slate-800 shadow-xs transition-all cursor-pointer"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* 효과음 토글 */}
            <button
              onClick={toggleMute}
              title={isMuted ? "효과음 켜기" : "효과음 끄기"}
              className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-800 shadow-xs transition-all cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* BGM 토글 */}
            <button
              onClick={toggleBgm}
              title={bgmPlaying ? "배경음악 끄기" : "배경음악 켜기"}
              className={`p-2 rounded-xl border shadow-xs transition-all cursor-pointer ${
                bgmPlaying
                  ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-600 dark:border-blue-500 shadow-blue-500/30"
                  : "bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border-slate-200/80 dark:border-slate-800"
              }`}
            >
              <Music className={`w-4 h-4 ${bgmPlaying ? "animate-pulse" : ""}`} />
            </button>

            {/* 구글 시트 연동 설정 버튼 */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="구글 시트 연동 설정"
              className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200/80 dark:border-slate-800 shadow-xs transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================
            1. 초기 시작 화면 (초반에는 게임 시작 버튼만 노출)
            ======================================================== */}
        {gameState === "INIT" && (
          <div className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl p-5 sm:p-8 shadow-2xl border border-sky-100 dark:border-slate-800 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200 transition-colors">
            {/* 인천대학교 마스코트 이미지 (타이틀 위에 배치) */}
            <div className="relative group mb-3">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full blur-sm opacity-40 group-hover:opacity-75 transition duration-300"></div>
              <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-md bg-sky-50 dark:bg-slate-800">
                <Image
                  src="/inu-mascot.jpg"
                  alt="인천대학교 마스코트 횃불이"
                  fill
                  sizes="(max-width: 640px) 96px, 128px"
                  className="object-cover"
                  priority
                />
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-blue-600 dark:bg-blue-500 text-white text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs whitespace-nowrap">
                인천대학교 마스코트
              </div>
            </div>

            {/* 타이틀 및 소개 문구 */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 mb-1">
              INU 벽돌깨기
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-5 text-center">
              연한 빨강 블록 3개를 가장 빠르게 깨고 명예의 전당에 등극하세요!
            </p>

            {/* 게임 조작 및 규칙 요약 카드 */}
            <div className="w-full bg-blue-50/60 dark:bg-slate-800/60 rounded-2xl p-3.5 sm:p-4 mb-4 border border-blue-100 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-300">
                  <Sparkles className="w-4 h-4 text-blue-500 dark:text-blue-400" /> 핵심 미션:
                </span>
                <span className="bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900">
                  연한 빨강 블록 3개 제거
                </span>
              </div>
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-600 dark:text-slate-400">조작 방식:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center gap-1">
                  <span>방향키(←, →)</span>
                  <span className="opacity-40">/</span>
                  <Smartphone className="w-3.5 h-3.5 text-blue-500 inline" />
                  <span>터치 스와이프</span>
                </span>
              </div>
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-600 dark:text-slate-400">주어진 생명:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">❤️❤️❤️ (3개)</span>
              </div>
            </div>

            {/* Top 3 명예의 전당 */}
            <div className="w-full mb-5">
              <LeaderboardCard
                top3={top3}
                loading={loadingLeaderboard}
                onRefresh={fetchLeaderboard}
              />
            </div>

            {/* 메인 '게임 시작' 버튼 (초반 노출) */}
            <button
              onClick={handleStartButtonClick}
              className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-base sm:text-lg rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transform active:scale-[0.99] transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
              게임 시작
            </button>
          </div>
        )}

        {/* ========================================================
            2. 사용자 이름 입력 화면
            ======================================================== */}
        {gameState === "INPUT_NAME" && (
          <div className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl p-5 sm:p-8 shadow-2xl border border-sky-100 dark:border-slate-800 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200 transition-colors">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-3 border-blue-500 shadow-md mb-3 bg-sky-50 dark:bg-slate-800">
              <Image
                src="/inu-mascot.jpg"
                alt="인천대학교 마스코트"
                fill
                sizes="(max-width: 640px) 64px, 80px"
                className="object-cover"
              />
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mb-1">
              플레이어 이름 입력
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 text-center">
              미션 성공 시 명예의 전당과 구글 시트에 기록될 이름을 입력하세요.
            </p>

            <form onSubmit={handleConfirmNameAndStart} className="w-full space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  플레이어 닉네임 / 이름
                </label>
                <input
                  type="text"
                  autoFocus
                  maxLength={12}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="예: 횃불이_123, 송도원탑"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-inner"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                  * 최대 12자까지 입력할 수 있습니다.
                </p>
              </div>

              <div className="flex gap-2.5 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setGameState("INIT")}
                  className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  뒤로
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  도전 시작 (3초 카운트다운)
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================
            3. 인게임 화면 (정사각형 560x560 틀 & 상단 제어 버튼)
            ======================================================== */}
        {["COUNTDOWN", "PLAYING", "PAUSED", "BALL_RESET", "SUCCESS", "FAILED"].includes(
          gameState
        ) && (
          <div className="w-full flex flex-col items-center">
            {/* 상단 인게임 헤더 HUD */}
            <div className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-2.5 sm:px-4 sm:py-3 mb-2.5 sm:mb-3 shadow-md border border-blue-100 dark:border-slate-800 flex items-center justify-between transition-colors">
              {/* 좌측: 생명 및 미션 달성 현황 */}
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">생명:</span>
                  <div className="flex items-center text-xs sm:text-sm">
                    {[1, 2, 3].map((val) => (
                      <span
                        key={val}
                        className={`transition-all duration-300 ${
                          val <= lives ? "text-rose-500 scale-100" : "text-slate-300 dark:text-slate-700 scale-90 opacity-40"
                        }`}
                      >
                        ❤️
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  <span>연한 빨강: {redDestroyed} / 3</span>
                </div>
              </div>

              {/* 중앙: 실시간 타이머 */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  진행 시간
                </span>
                <div className="flex items-center gap-1 text-sm sm:text-lg font-mono font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/60 px-2 sm:px-2.5 py-0.5 rounded-lg border border-blue-100 dark:border-blue-900">
                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500 dark:text-blue-400" />
                  {formatTime(elapsedMs)}
                </div>
              </div>

              {/* 우측: 일시 정지 & 다시 시작 버튼 */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  onClick={handleTogglePause}
                  disabled={gameState !== "PLAYING" && gameState !== "PAUSED"}
                  className={`px-2 sm:px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                    gameState === "PAUSED"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                  title="일시 정지"
                >
                  {gameState === "PAUSED" ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span className="hidden xs:inline">계속</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">일시정지</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleRestartToNameScreen}
                  className="px-2 sm:px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                  title="이름 작성 화면으로 이동하여 다시 시작"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">다시 시작</span>
                </button>
              </div>
            </div>

            {/* 깔끔한 정사각형 틀 안의 캔버스 컨테이너 (터치 스와이프 조작 지원) */}
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              className="relative w-full aspect-square max-w-[560px] rounded-3xl overflow-hidden shadow-2xl border-4 border-white/80 dark:border-slate-800 bg-white dark:bg-slate-900 touch-none select-none transition-colors"
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="w-full h-full block touch-none"
              />

              {/* 3초 카운트다운 오버레이 */}
              {gameState === "COUNTDOWN" && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-blue-950/40 dark:bg-black/60 backdrop-blur-xs animate-in fade-in">
                  <div className="text-center px-4">
                    <span className="text-6xl sm:text-8xl font-black text-white drop-shadow-xl animate-bounce tracking-tight">
                      {countdownNum === 0 ? "START!" : countdownNum}
                    </span>
                    <p className="text-white/90 text-xs sm:text-sm font-bold mt-3 drop-shadow flex items-center justify-center gap-1.5">
                      <span>방향키(←, →)</span>
                      <span>또는</span>
                      <Smartphone className="w-4 h-4 inline" />
                      <span>터치 스와이프로 조작</span>
                    </p>
                  </div>
                </div>
              )}

              {/* 일시 정지 오버레이 */}
              {gameState === "PAUSED" && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-xs animate-in fade-in p-4">
                  <div className="bg-white/95 dark:bg-slate-900/95 rounded-2xl p-6 shadow-2xl text-center max-w-xs w-full border border-blue-100 dark:border-slate-800">
                    <div className="p-3 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                      <Pause className="w-6 h-6" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-1">
                      게임 일시 정지됨
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      잠시 휴식 후 언제든 다시 시작하세요.
                    </p>
                    <button
                      onClick={handleTogglePause}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                    >
                      게임 계속하기
                    </button>
                  </div>
                </div>
              )}

              {/* [신규 기능] 공 재배치 (하단 추락 후 새로운 공 나타남) 오버레이 */}
              {gameState === "BALL_RESET" && (
                <div
                  onClick={launchAttachedBall}
                  className="absolute inset-x-0 bottom-20 sm:bottom-24 z-10 flex justify-center px-4 animate-in fade-in cursor-pointer"
                >
                  <div className="bg-slate-900/90 dark:bg-blue-950/90 text-white text-[11px] sm:text-xs font-bold px-4 py-2 rounded-full shadow-lg backdrop-blur-xs border border-white/20 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    <span>새로운 공 준비 완료! (터치 또는 스페이스바)</span>
                  </div>
                </div>
              )}

              {/* ========================================================
                  4. 미션 성공 팝업 & 폭죽 연출
                  ======================================================== */}
              {gameState === "SUCCESS" && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in zoom-in-95">
                  <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl text-center border-2 border-amber-300 dark:border-amber-500">
                    <div className="w-16 h-16 bg-gradient-to-tr from-amber-400 to-yellow-300 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-300/50">
                      <Trophy className="w-8 h-8 fill-white" />
                    </div>

                    <span className="inline-block text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-3 py-1 rounded-full mb-2">
                      축하합니다! 미션 클리어
                    </span>

                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
                      미션 성공!
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      연한 빨강 블록 3개를 모두 제거하였습니다!
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-3.5 mb-4 border border-slate-100 dark:border-slate-700 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">플레이어:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{playerName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">완료 시간:</span>
                        <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                          {lastClearTime}
                        </span>
                      </div>
                      {lastRank && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 dark:text-slate-400">전체 랭킹:</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {lastRank}위 {lastRank <= 3 && "🏆 Top 3 입성!"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleRetrySameName}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                      >
                        다시 도전하기
                      </button>
                      <button
                        onClick={() => setGameState("INIT")}
                        className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        처음으로
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================
                  5. 미션 실패 팝업
                  ======================================================== */}
              {gameState === "FAILED" && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in zoom-in-95">
                  <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl text-center border border-rose-200 dark:border-rose-900">
                    <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-3">
                      <ShieldAlert className="w-7 h-7" />
                    </div>

                    <h3 className="text-xl font-black text-rose-600 dark:text-rose-400 mb-1">
                      게임 미션 실패
                    </h3>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                      다시 도전하시겠습니까?
                    </p>

                    <div className="bg-rose-50/60 dark:bg-rose-950/40 rounded-xl p-3 mb-5 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <p>남은 연한 빨강 블록: {3 - redDestroyed}개</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        생명이 모두 소진되었습니다. 다시 도전해 보세요!
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleRetrySameName}
                        className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/25 transition-all cursor-pointer"
                      >
                        다시 도전하기
                      </button>
                      <button
                        onClick={handleRestartToNameScreen}
                        className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        이름 변경
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 조작 가이드 안내 */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-2xs font-mono font-bold text-[11px]">
                  ←
                </kbd>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-2xs font-mono font-bold text-[11px]">
                  →
                </kbd>
                좌우 이동
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                모바일 스와이프
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-2xs font-mono font-bold text-[11px]">
                  Space
                </kbd>
                / 화면 터치: 공 발사
              </span>
            </div>
          </div>
        )}
      </div>

      {/* [신규 기능] 사이트 하단 제작자 표기: 'by choieunhye' */}
      <footer className="w-full max-w-[560px] mt-6 mb-2 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
        <p className="flex items-center justify-center gap-2">
          <span>INU 벽돌깨기</span>
          <span className="opacity-50">•</span>
          <span className="font-semibold text-slate-600 dark:text-slate-300">by choieunhye</span>
        </p>
      </footer>

      {/* 구글 스프레드시트 설정 모달 */}
      <GoogleSheetSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
