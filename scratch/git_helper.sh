#!/bin/bash
cd /home/lexus/projects/telegramBots/fb_insta_voice_msg
echo "=== Running git status ===" > scratch/git_status.txt
git status >> scratch/git_status.txt 2>&1
