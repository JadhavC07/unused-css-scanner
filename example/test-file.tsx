import { View, StyleSheet, Text } from "react-native";

const TestComponent = () => {
  const styles = StyleSheet.create({
    container: { flex: 1 },
    used: { color: "red" },
    
    
  });

  // Direct access
  const view1 = <View style={styles.container} />;

  // Alias pattern
  const s = styles;
  const text1 = <Text style={s.used} />;

  // Spread pattern
  const view2 = <View style={{ ...styles.container }} />;

  return (
    <View>
      {view1}
      {text1}
      {view2}
    </View>
  );
};

export default TestComponent;
