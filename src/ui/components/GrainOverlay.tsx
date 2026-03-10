import { Image, StyleSheet, View } from 'react-native';

/**
 * Full-screen film grain texture overlay.
 * Place as the first child of any screen's root View so it renders
 * behind all content. pointer-events are disabled so it never
 * intercepts touches.
 */
export function GrainOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Image
        source={require('../../../assets/images/grain.png')}
        style={styles.grain}
        resizeMode="repeat"
        fadeDuration={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.055,
  },
});
