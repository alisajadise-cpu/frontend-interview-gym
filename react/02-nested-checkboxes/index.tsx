export type TreeNode = {
  id: string;
  label: string;
  children?: TreeNode[];
};

export type CheckboxTreeProps = {
  nodes: TreeNode[];
  defaultChecked?: string[];
  onChange?: (checkedLeafIds: string[]) => void;
};

export function CheckboxTree(props: CheckboxTreeProps) {
  // TODO: implement. See README.md for the full spec.
  return <div>TODO: implement CheckboxTree</div>;
}
