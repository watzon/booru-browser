// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'magnifyingglass': 'search',
  'line.3.horizontal.decrease': 'tune',
  'arrow.up.arrow.down': 'swap-vert',
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
  'speaker.fill': 'volume-up',
  'speaker.slash.fill': 'volume-off',
  'star.fill': 'star',
  'star': 'star-border',
  'gearshape.fill': 'settings',
  'server.rack': 'storage',
  'square.and.arrow.down': 'file-download',
  'square.and.arrow.up': 'ios-share',
  'plus': 'add',
  'xmark': 'close',
  'lock.fill': 'lock',
  'lock.open.fill': 'lock-open',
  'qrcode': 'qr-code-2',
  'qrcode.viewfinder': 'qr-code-scanner',
  'doc.text': 'description',
  'link': 'link',
  'photo.fill': 'photo',
  'trash': 'delete',
  'video.fill': 'videocam',
  'square.grid.2x2': 'grid-view',
  'rectangle.portrait': 'crop-portrait',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
