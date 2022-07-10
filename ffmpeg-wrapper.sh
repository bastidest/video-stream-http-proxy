#!/bin/bash
set -eo pipefail

FFMPEG="ffmpeg"
MKDIR=0
TARGET_LATENCY=4
CLEAN_ON_EXIT=0

function print_usage() {
    echo "usage: ffmpeg-wrapper.sh [--use-docker] [--mkdir] [--target-latency seconds] [--clean-on-exit] RTSP_URL OUTPUT_PATH"
}

TEMP=$(getopt -o '' --long 'use-docker,mkdir,target-latency:,clean-on-exit' -n 'ffmpeg-wrapper.sh' -- "$@")
if [[ $? -ne 0 ]] ; then
    echo "failed to parse command line arguments" >&2
    exit 1
fi
eval set -- "$TEMP"
unset TEMP

while true; do
    case "$1" in
        '--use-docker')
            FFMPEG="docker run --rm -v$(pwd):$(pwd) -w$(pwd) -u$(id -u):$(id -g) -v/dev/shm:/dev/shm -it mwader/static-ffmpeg:5.0.1-3"
            shift
            continue
            ;;
        '--mkdir')
            MKDIR=1
            shift
            continue
            ;;
        '--target-latency')
            TARGET_LATENCY="$2"
            shift 2

            if [[ "$TARGET_LATENCY" -lt 3 || "$TARGET_LATENCY" -gt 3600 ]] ; then
                echo 'target latency should be in the range [3,3600]' >&2
                exit 1
            fi
            continue
            ;;
        '--clean-on-exit')
            CLEAN_ON_EXIT=1
            shift
            continue
            ;;
        '--')
            shift
            break
            ;;
        *)
            echo 'parsing error' >&2
            exit 1
            ;;
    esac
done

# two positional arguments: RTSP_URL and OUTPUT_PATH
if [[ $# -ne 2 ]] ; then
    print_usage
    exit 1
fi

RTSP_URL="$1"
shift
OUTPUT_PATH="$1"
shift

O_INPUT_LATENCY="-fflags nobuffer -flags low_delay"

# 3s socket timeout
O_INPUT_FLUSH="-flush_packets 1 -max_delay 2 -rtsp_transport tcp -timeout 3000000"

# O_INPUT_NEG_TS="-avoid_negative_ts make_non_negative"
O_CONVERT="-c:v copy -b:v 2000k"
# AUDIO_OPTS="-c:a aac -b:a 160000 -ac 2"
# VIDEO_OPTS="-c:v libx264 -b:v 800000"
# OUTPUT_HLS="-hls_time 10 -hls_list_size 10 -start_number 1"
# ffmpeg -i "$RTSP_URL" -y $AUDIO_OPTS $VIDEO_OPTS $OUTPUT_HLS playlist.m3u8

# create keyframes at least every x seconds, at most every x seconds and disable scene detection
KEYFRAME_INTERVAL_FRAMES="10"
O_KEYFRAMES="-keyint_min ${KEYFRAME_INTERVAL_FRAMES} -g ${KEYFRAME_INTERVAL_FRAMES} -sc_threshold 0"

### DASH
# https://blog.zazu.berlin/internet-programmierung/mpeg-dash-and-hls-adaptive-bitrate-streaming-with-ffmpeg.html
# https://dvb.org/wp-content/uploads/2020/03/Dash-LL.pdf

FFMPEG_PID=0

function _handler() {
    GOT_SIGNAL=$1

    if [[ $FFMPEG_PID -gt 0 ]] ; then
        kill "-${GOT_SIGNAL}" $FFMPEG_PID
        (
            COUNTER=0
            while kill -0 $FFMPEG_PID 2>/dev/null && [[ $COUNTER -lt 20 ]] ; do
                ((COUNTER=COUNTER+1))
                sleep 0.1
            done
            kill -0 $FFMPEG_PID 2>/dev/null && echo "ffmpeg process did not stop after 2 seconds, sending SIGKILL" && kill -9 $FFMPEG_PID
        )&
    fi
}

trap '_handler SIGTERM' SIGTERM
trap '_handler SIGINT'  SIGINT

function stream() {
    if [[ $MKDIR -gt 0 ]] ; then
        mkdir -p "${OUTPUT_PATH}"
    fi

    while [[ -z "$GOT_SIGNAL" ]] ; do
        ${FFMPEG} \
            ${O_INPUT_FLUSH} \
            ${O_INPUT_NEG_TS} \
            -fflags +genpts \
            -i "${RTSP_URL}" \
            ${O_CONVERT} \
            ${VIDEO_OPTS} \
            ${O_KEYFRAMES} \
            ${O_INPUT_LATENCY} \
            -f dash \
            -utc_timing_url "https://time.akamai.com" \
            -ldash 1 \
            -streaming 1 \
            -use_template 1 \
            -use_timeline 1 \
            -seg_duration 1 \
            -window_size 60 \
            -frag_type none \
            -tune zerolatency \
            -target_latency "${TARGET_LATENCY}" \
            -format_options "movflags=cmaf" \
            -export_side_data prft -write_prft 1 \
            "${OUTPUT_PATH}/manifest.mpd" &
        FFMPEG_PID=$!
        wait ${FFMPEG_PID} || true
    done

    # wait for all other background tasks to finish (if there are any)
    wait

    if [[ $CLEAN_ON_EXIT -gt 0 ]] ; then
        echo "cleaning directory ${OUTPUT_PATH}"
        rm -rf "${OUTPUT_PATH}"
    fi
}

function play() {
    ffplay \
        ${O_INPUT_FLUSH} \
        ${O_INPUT_NEG_TS} \
        -i "${RTSP_URL}" \
        ${VIDEO_OPTS} \
        ${O_KEYFRAMES} \
        ${O_INPUT_LATENCY}
}

if [[ "$1" == "play" ]] ; then
    play
else
    stream
fi
