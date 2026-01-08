import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
} from 'react-native';
import { TimePicker } from './TimePicker';

interface TimeRangePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onApply: (startTime: string, endTime: string) => void;
    initialStartTime?: string; // "HH:mm"
    initialEndTime?: string;   // "HH:mm"
}

const parseTime = (timeStr?: string): { hours: number; minutes: number } => {
    if (!timeStr) return { hours: 0, minutes: 0 };
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours: hours || 0, minutes: minutes || 0 };
};

const formatTime = (time: { hours: number; minutes: number }): string => {
    return `${time.hours.toString().padStart(2, '0')}:${time.minutes.toString().padStart(2, '0')}`;
};

export const TimeRangePickerModal = ({
    visible,
    onClose,
    onApply,
    initialStartTime,
    initialEndTime,
}: TimeRangePickerModalProps) => {
    const [startTime, setStartTime] = useState(parseTime(initialStartTime || '00:00'));
    const [endTime, setEndTime] = useState(parseTime(initialEndTime || '23:59'));

    const handleApply = () => {
        onApply(formatTime(startTime), formatTime(endTime));
        onClose();
    };

    const handleClear = () => {
        onApply('', ''); // Clear time filter
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <Text style={styles.title}>Select Time Range</Text>

                    <View style={styles.pickersContainer}>
                        <View style={styles.pickerSection}>
                            <TimePicker
                                label="Start Time"
                                value={startTime}
                                onChange={setStartTime}
                            />
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.pickerSection}>
                            <TimePicker
                                label="End Time"
                                value={endTime}
                                onChange={setEndTime}
                            />
                        </View>
                    </View>

                    <View style={styles.buttonsRow}>
                        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
                            <Text style={styles.clearButtonText}>Clear</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
                            <Text style={styles.applyButtonText}>Apply</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        padding: 20,
    },
    content: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 24,
    },
    pickersContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    pickerSection: {
        flex: 1,
        alignItems: 'center',
    },
    divider: {
        width: 1,
        height: 150,
        backgroundColor: '#334155',
        marginHorizontal: 16,
    },
    buttonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    clearButton: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        backgroundColor: '#334155',
        alignItems: 'center',
    },
    clearButtonText: {
        color: '#94a3b8',
        fontWeight: '600',
        fontSize: 16,
    },
    cancelButton: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        backgroundColor: '#334155',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    applyButton: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
    },
    applyButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
