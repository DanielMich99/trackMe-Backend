import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Dimensions,
} from 'react-native';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface TimePickerProps {
    value: { hours: number; minutes: number };
    onChange: (value: { hours: number; minutes: number }) => void;
    label?: string;
}

const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = Array.from({ length: 60 }, (_, i) => i);

const WheelColumn = ({
    data,
    selectedValue,
    onValueChange,
}: {
    data: number[];
    selectedValue: number;
    onValueChange: (value: number) => void;
}) => {
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        const index = data.indexOf(selectedValue);
        if (index >= 0) {
            flatListRef.current?.scrollToOffset({
                offset: index * ITEM_HEIGHT,
                animated: false,
            });
        }
    }, []);

    const handleMomentumScrollEnd = (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / ITEM_HEIGHT);
        const clampedIndex = Math.min(Math.max(index, 0), data.length - 1);
        onValueChange(data[clampedIndex]);
    };

    const renderItem = ({ item, index }: { item: number; index: number }) => {
        return (
            <View style={styles.itemContainer}>
                <Text style={styles.itemText}>
                    {item.toString().padStart(2, '0')}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.columnContainer}>
            {/* Selection indicator */}
            <View style={styles.selectionIndicator} pointerEvents="none" />

            <FlatList
                ref={flatListRef}
                data={data}
                keyExtractor={(item) => item.toString()}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                onMomentumScrollEnd={handleMomentumScrollEnd}
                getItemLayout={(_, index) => ({
                    length: ITEM_HEIGHT,
                    offset: ITEM_HEIGHT * index,
                    index,
                })}
                contentContainerStyle={{
                    paddingVertical: ITEM_HEIGHT * 2,
                }}
            />
        </View>
    );
};

export const TimePicker = ({ value, onChange, label }: TimePickerProps) => {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={styles.pickersRow}>
                <WheelColumn
                    data={hours}
                    selectedValue={value.hours}
                    onValueChange={(h) => onChange({ ...value, hours: h })}
                />
                <Text style={styles.separator}>:</Text>
                <WheelColumn
                    data={minutes}
                    selectedValue={value.minutes}
                    onValueChange={(m) => onChange({ ...value, minutes: m })}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    label: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    pickersRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    columnContainer: {
        height: PICKER_HEIGHT,
        width: 60,
        overflow: 'hidden',
    },
    selectionIndicator: {
        position: 'absolute',
        top: ITEM_HEIGHT * 2,
        left: 0,
        right: 0,
        height: ITEM_HEIGHT,
        backgroundColor: '#334155',
        borderRadius: 8,
        zIndex: -1,
    },
    itemContainer: {
        height: ITEM_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '600',
    },
    separator: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
        marginHorizontal: 8,
    },
});
