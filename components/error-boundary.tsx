import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { reportError } from '@/lib/log';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportError(error, { componentStack: info.componentStack ?? undefined, source: 'ErrorBoundary' });
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    // The boundary can't know the active color scheme without a hook, so we
    // pick a neutral surface that reads OK on both themes.
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          {this.state.error.message || 'An unexpected error occurred.'}
        </Text>
        <Button label="Try again" onPress={this.handleRetry} variant="primary" />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  title: {
    color: Colors.dark.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  body: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    maxWidth: 360,
  },
});
