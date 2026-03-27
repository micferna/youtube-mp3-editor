#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🎵 YouTube MP3 Editor — Starting...${NC}"
echo ""

# Check dependencies
check_cmd() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed.${NC}"
        echo "  Install it with: $2"
        exit 1
    fi
}

check_cmd python3 "sudo apt install python3"
check_cmd node "sudo apt install nodejs"
check_cmd ffmpeg "sudo apt install ffmpeg"
check_cmd yt-dlp "pip install yt-dlp"

cd "$(dirname "$0")"

# Setup Python venv
if [ ! -d "venv" ]; then
    echo -e "${CYAN}Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi
source venv/bin/activate

# Install backend deps
echo -e "${CYAN}Installing backend dependencies...${NC}"
pip install -q -r backend/requirements.txt

# Install frontend deps
echo -e "${CYAN}Installing frontend dependencies...${NC}"
cd frontend
npm install --silent
cd ..

# Create data directories
mkdir -p data/downloads data/exports data/temp data/waveforms

MODE="${1:-dev}"

if [ "$MODE" = "prod" ]; then
    echo -e "${CYAN}Building frontend for production...${NC}"
    cd frontend
    npm run build
    cd ..
    echo -e "${GREEN}Starting production server on http://localhost:8000${NC}"
    python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
else
    echo ""
    echo -e "${GREEN}Starting dev servers...${NC}"
    echo -e "  Backend:  http://localhost:8000"
    echo -e "  Frontend: http://localhost:5173"
    echo ""

    # Start backend in background
    python3 -m uvicorn backend.main:app --reload --port 8000 &
    BACKEND_PID=$!

    # Start frontend
    cd frontend
    npx vite --port 5173 &
    FRONTEND_PID=$!

    cd ..

    # Trap to kill both on exit
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM EXIT

    echo -e "${GREEN}Both servers running. Press Ctrl+C to stop.${NC}"
    wait
fi
