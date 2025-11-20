import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TestComponent = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello World</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 20,
  },
  unusedStyle: {
    color: 'red',
  },
  anotherUnused: {
    padding: 10,
  },
});

export default TestComponent;