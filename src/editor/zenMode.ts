import type { IconParkName } from './iconParkIcons';

export interface ZenToggleState {
  ariaLabelKey: string;
  icon: IconParkName;
  isPressed: boolean;
  titleKey: string;
}

export interface ZenToggleBounds {
  height: number;
  margin: number;
  size: number;
  width: number;
}

export interface ZenTogglePosition {
  left: number;
  top: number;
}

export function createZenToggleState(isZenMode: boolean): ZenToggleState {
  return isZenMode
    ? {
        ariaLabelKey: 'exitZenMode',
        icon: 'Unlock',
        isPressed: true,
        titleKey: 'exitZenMode',
      }
    : {
        ariaLabelKey: 'enterZenMode',
        icon: 'Lock',
        isPressed: false,
        titleKey: 'enterZenMode',
      };
}

export function clampZenTogglePosition(
  position: ZenTogglePosition,
  bounds: ZenToggleBounds,
): ZenTogglePosition {
  const min = bounds.margin;
  const maxLeft = Math.max(min, bounds.width - bounds.size - bounds.margin);
  const maxTop = Math.max(min, bounds.height - bounds.size - bounds.margin);

  return {
    left: Math.min(Math.max(position.left, min), maxLeft),
    top: Math.min(Math.max(position.top, min), maxTop),
  };
}
