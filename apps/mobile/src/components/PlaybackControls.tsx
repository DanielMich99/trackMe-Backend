import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface PlaybackControlsProps {
    isPlaying: boolean;
    currentSeconds: number;
    activeSegments: { start: number; end: number }[];
    onTogglePlay: () => void;
    onStepBack: () => void;
    onStepForward: () => void;
    currentTimeLabel: string;
    timeRangeStart?: number;
    timeRangeEnd?: number;
    totalPoints: number;
    currentPointIndex: number;
}

const formatSecondsToTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export const PlaybackControls = ({
    isPlaying,
    currentSeconds,
    activeSegments,
    onTogglePlay,
    onStepBack,
    onStepForward,
    currentTimeLabel,
    timeRangeStart = 0,
    timeRangeEnd = 86399,
    totalPoints,
    currentPointIndex,
}: PlaybackControlsProps) => {
    const rangeSpan = timeRangeEnd - timeRangeStart;

    // Long press state for accelerating navigation
    const longPressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const stepCountRef = useRef(0);
    const isHoldingRef = useRef(false);

    // Calculate current interval based on how long we've been holding
    // Starts at 300ms, decreases to 50ms minimum
    const getInterval = useCallback(() => {
        const baseInterval = 300;
        const minInterval = 50;
        const acceleration = Math.min(stepCountRef.current * 10, baseInterval - minInterval);
        return baseInterval - acceleration;
    }, []);

    const startLongPress = useCallback((direction: 'back' | 'forward') => {
        isHoldingRef.current = true;
        stepCountRef.current = 0;

        const step = direction === 'back' ? onStepBack : onStepForward;

        // Initial step
        step();
        stepCountRef.current++;

        const scheduleNextStep = () => {
            if (!isHoldingRef.current) return;

            longPressIntervalRef.current = setTimeout(() => {
                if (!isHoldingRef.current) return;
                step();
                stepCountRef.current++;
                scheduleNextStep();
            }, getInterval());
        };

        // Start the acceleration loop after initial delay
        longPressIntervalRef.current = setTimeout(() => {
            if (isHoldingRef.current) {
                scheduleNextStep();
            }
        }, 400); // Delay before long-press kicks in
    }, [onStepBack, onStepForward, getInterval]);

    const stopLongPress = useCallback(() => {
        isHoldingRef.current = false;
        stepCountRef.current = 0;
        if (longPressIntervalRef.current) {
            clearTimeout(longPressIntervalRef.current);
            longPressIntervalRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopLongPress();
        };
    }, [stopLongPress]);

    // Calculate thumb position for display
    const thumbPosition = useMemo(() => {
        if (rangeSpan === 0) return 0;
        const pos = ((currentSeconds - timeRangeStart) / rangeSpan) * 100;
        return Math.max(0, Math.min(100, pos));
    }, [currentSeconds, timeRangeStart, rangeSpan]);

    // Calculate relative position for segments within the selected range
    const relativeSegments = useMemo(() => {
        return activeSegments
            .filter(seg => seg.end >= timeRangeStart && seg.start <= timeRangeEnd)
            .map(seg => ({
                start: Math.max(seg.start, timeRangeStart),
                end: Math.min(seg.end, timeRangeEnd),
            }));
    }, [activeSegments, timeRangeStart, timeRangeEnd]);

    return (
        <View style={styles.container}>
            <View style={styles.controlsRow}>
                <TouchableOpacity
                    style={styles.playButton}
                    onPress={onTogglePlay}
                >
                    <FontAwesome5
                        name={isPlaying ? "pause" : "play"}
                        size={20}
                        color="#fff"
                        style={{ marginLeft: isPlaying ? 0 : 4 }}
                    />
                </TouchableOpacity>

                {/* Step Back Button with Long Press */}
                <Pressable
                    style={({ pressed }) => [
                        styles.stepButton,
                        pressed && styles.stepButtonPressed
                    ]}
                    onPressIn={() => startLongPress('back')}
                    onPressOut={stopLongPress}
                >
                    <FontAwesome5 name="chevron-left" size={16} color="#fff" />
                </Pressable>

                <View style={styles.sliderWrapper}>
                    <Text style={styles.timeDisplay}>
                        {currentTimeLabel}
                    </Text>

                    {/* Timeline Visualization (read-only, no drag) */}
                    <View style={styles.timelineContainer}>
                        <View style={styles.timelineTrack}>
                            {relativeSegments.map((seg, idx) => (
                                <View
                                    key={idx}
                                    style={[
                                        styles.timelineSegment,
                                        {
                                            left: `${((seg.start - timeRangeStart) / rangeSpan) * 100}%`,
                                            width: `${Math.max(((seg.end - seg.start) / rangeSpan) * 100, 1)}%`
                                        }
                                    ]}
                                />
                            ))}
                        </View>

                        {/* Static Thumb (position indicator only) */}
                        <View style={[styles.thumb, { left: `${thumbPosition}%` }]} />
                    </View>

                    <View style={styles.timeLabelsRow}>
                        <Text style={styles.timeLabelTick}>{formatSecondsToTime(timeRangeStart)}</Text>
                        <Text style={styles.timeLabelTick}>{formatSecondsToTime(timeRangeStart + rangeSpan * 0.5)}</Text>
                        <Text style={styles.timeLabelTick}>{formatSecondsToTime(timeRangeEnd)}</Text>
                    </View>

                    {/* Progress indicator */}
                    <Text style={styles.progressText}>
                        {currentPointIndex + 1} / {totalPoints}
                    </Text>
                </View>

                {/* Step Forward Button with Long Press */}
                <Pressable
                    style={({ pressed }) => [
                        styles.stepButton,
                        pressed && styles.stepButtonPressed
                    ]}
                    onPressIn={() => startLongPress('forward')}
                    onPressOut={stopLongPress}
                >
                    <FontAwesome5 name="chevron-right" size={16} color="#fff" />
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    playButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    stepButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepButtonPressed: {
        backgroundColor: '#475569',
        transform: [{ scale: 0.95 }],
    },
    sliderWrapper: {
        flex: 1,
    },
    timeDisplay: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    timelineContainer: {
        height: 20,
        justifyContent: 'center',
        marginBottom: 4,
    },
    timelineTrack: {
        height: 6,
        backgroundColor: '#334155',
        borderRadius: 3,
        overflow: 'hidden',
    },
    timelineSegment: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: '#3b82f6',
    },
    thumb: {
        position: 'absolute',
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#60a5fa',
        borderWidth: 2,
        borderColor: '#fff',
        marginLeft: -8, // Center the thumb
        top: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 3,
    },
    timeLabelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
    },
    timeLabelTick: {
        color: '#64748b',
        fontSize: 9,
    },
    progressText: {
        color: '#94a3b8',
        fontSize: 11,
        textAlign: 'center',
        marginTop: 4,
    },
});
