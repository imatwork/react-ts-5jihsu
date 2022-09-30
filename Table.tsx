import React, { useMemo } from 'react';
import * as ReactIs from 'react-is';
import { View, Text } from '@react-pdf/renderer';
import { Style } from '@react-pdf/types';
import flattenDeep from 'lodash/flattenDeep';

function _assert(
  pred: boolean,
  msg: string = 'Assertion Error',
  ErrorCls = Error
): asserts pred {
  if (!pred) {
    throw new ErrorCls(msg);
  }
}

type JSXBaseInputType =
  | JSX.Element
  | boolean
  | number
  | string
  | undefined
  | null;
type JSXInputType =
  | JSXBaseInputType
  | JSXBaseInputType[]
  | JSXBaseInputType[][]
  | JSXBaseInputType[][][];
function jsxNormalize(arg0: JSXInputType): JSX.Element[] {
  const arg0Array = (Array.isArray(arg0) ? arg0 : [arg0]) || [];
  const children = flattenDeep(arg0Array);
  return (
    children
      .filter((c) => !!c) // remove undefined, null, false, things that are falsy
      // Convert everything to elements if not already
      .map((c) => (ReactIs.isElement(c) ? c : <Text>c</Text>)) as JSX.Element[]
  );
}

/**Gets all nested real children inside of JSX.Elements and fragments*/
function getChildrenInFragments(arg0: JSXInputType): JSX.Element[] {
  const childrenArray = jsxNormalize(arg0);
  const children = childrenArray
    .map((c) => {
      if (!ReactIs.isFragment(c)) {
        return c; // return as-is if not something to unwrap from
      }
      if (!c.props.children) {
        return [];
      }
      return getChildrenInFragments(c.props.children);
    })
    .flat();
  return children;
}
/**Get a JSX.Elemengt mixed in with the passed props*/
function elementWithProps(el: JSX.Element, props: object) {
  // elements/props are readonly, they have to be cloned/props has to be cloned
  return Object.assign({}, el, {
    props: Object.assign({}, el.props, props),
  });
}

interface TableProps {
  children: any; //JSX.Element | JSX.Element[],
  style?: Style;
  wrap?: boolean;
  colStyles?: Style[];
}
/**A table-like element using pdf elements. It will take a list of TRows each of
 * which contain 2 elements. These elements will be flex'd next to each other
 * and can have their styles BY COLUMN in an array on this element
 *
 * Example:
 * If you want a 2 column table with 25% for the first row, and right aligned 75%
 * for the second row...
 * ```
 * <Table colStyles={[{width: '25%'}, {width: '75%', align: 'right'}]}>
 *   <TRow />
 *   <TRow />
 * </Table>
 * ```
 */
export function Table(props: TableProps) {
  const { children, colStyles, style, wrap } = props;
  // Find every direct TRow or THead and add properties to their direct children
  const childrenWithCols = getChildrenInFragments(children).map((c) =>
    elementWithProps(c, { colStyles: colStyles || [] })
  );

  return (
    <View style={{ flexDirection: 'column', ...style }} wrap={wrap ?? true}>
      {childrenWithCols}
    </View>
  );
}

/**Gets the TRow children with styles applied*/
function getChildrenForTRowStyled(
  arg0: JSX.Element | JSX.Element[],
  styles: Style[]
): JSX.Element[] {
  const children = getChildrenInFragments(arg0);
  if (children.length !== styles.length) {
    console.warn(
      `Got '${children.length}' children in TRow but only '${styles.length}' styles`
    );
  }

  return children.map((c, idx) => {
    const style = styles[idx] ?? {};
    const newStyle = Object.assign({}, style, c?.props?.style);
    return elementWithProps(c, { style: newStyle });
  });
}

interface TRowProps {
  children?: JSX.Element | JSX.Element[];
  style?: Style;
  colStyles?: Style[];
  debug?: boolean;
}
export function TRow(props: TRowProps) {
  const { children, colStyles, style, debug } = props;
  // Find every direct TRow or THead and add properties to their direct children
  const childrenWithCol = getChildrenForTRowStyled(
    children || [],
    colStyles ?? []
  );

  return (
    <View debug={debug} style={{ flexDirection: 'row', ...style }}>
      {childrenWithCol}
    </View>
  );
}

type AutoColStyles = (Style | ((idx: number) => Style))[];
interface AutoTableProps {
  children: any; //JSX.Element | JSX.Element[],
  /**colStyles for the table, can contain a function that generates styles and it
   * will be called for any row we are missing a col style for*/
  colStyles: AutoColStyles;
}

type AutoArray<T> = (T | ((idx: number) => T))[];
export function expandAutoArray<T>(autoArray: AutoArray<T>, toLength: number) {
  return autoArray
    .map((item, idx) => {
      if (typeof item !== 'function') {
        return item; // Return this col as-is
      }
      const fn = item as (idx: number) => T;
      // Otherwise it's a function to generate new cols for any we dont have
      const colStylesToGen = toLength - autoArray.length + 1; //+1 bc one of the autoCols passed was the gen function
      return new Array(colStylesToGen).fill(0).map((_, idx2) => fn(idx + idx2));
    })
    .flat();
}

/**Table that takes rows as AutoTXXX classes and takes an auto array as colStyles
 * (which can expand based on the amount of rows in the AutoTXXX row classes)*/
export function AutoTable(props: AutoTableProps) {
  const { children, colStyles } = props;
  // Figure out the column count from the children
  const rows = getChildrenInFragments(children);
  const row0 = rows[0];
  _assert(!!row0, 'At least one row must be passed to AutoTable');
  const cells = row0.props.cells;
  if (cells.find((c: any) => typeof c === 'function')) {
    throw new Error(
      'First row cannot contain an auto array (like TSubHead cells propterty)'
    );
  }
  const colCount = cells.length;

  // Generate the auto column styles based on column length
  const autoColStyles = expandAutoArray(colStyles, colCount);
  if (colCount !== autoColStyles.length) {
    throw new Error(
      `colCount and autoColStyles are not equal, ${colCount} !== ${autoColStyles.length}`
    );
  }

  // Ensure all rows are the same length and correct type
  const filteredRows = rows.filter((row) => {
    if (row.type !== AutoTRow) {
      console.error(
        `Warning: AutoTable children must be of correct type, got ${row.type}. Skipping element`
      );
      console.error(row);
      console.error(rows);
      return false;
    }
    const cellLength = expandAutoArray(row.props.cells, colCount).length;
    if (cellLength !== colCount) {
      console.error(
        `Warning: AutoTable row must be of correct length, got ${cellLength}, expected ${colCount}. Skipping element`
      );
      console.error(row);
      console.error(rows);
      return false;
    }
    return true;
  });

  const width = widthFromColStyles(autoColStyles);

  return (
    <Table style={{ width }} colStyles={autoColStyles}>
      {filteredRows}
    </Table>
  );
}

interface AutoTRowProps extends TRowProps {
  cells: AutoArray<string | number>;
}
export function AutoTRow(props: AutoTRowProps) {
  const { cells } = props;
  // Cells can be an auto array, so expand it
  const autoCells = expandAutoArray(cells, props.colStyles!.length);

  return (
    <TRow {...props}>
      {autoCells.map((v, idx) => (
        <Text key={idx}>{v}</Text>
      ))}
    </TRow>
  );
}

function fromPx(s?: string | number) {
  if (typeof s === 'number') {
    return s;
  }
  if (!s) {
    return 0;
  }
  return parseFloat(s.slice(0, -2));
}

/** Get the width from an array of cols*/
export function widthFromColStyles(colStyles: Style[]): number {
  return colStyles.reduce(
    (acc, colStyle) =>
      acc + fromPx(colStyle.width) + fromPx(colStyle.marginRight),
    0
  );
}
