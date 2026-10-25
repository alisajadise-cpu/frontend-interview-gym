export type Todo = { id: string; title: string; done: boolean };

export type TodoApi = {
  list: () => Promise<Todo[]>;
  create: (title: string) => Promise<Todo>;
  toggle: (id: string, done: boolean) => Promise<Todo>;
  remove: (id: string) => Promise<void>;
};

export function TodoApp({ api }: { api: TodoApi }) {
  // TODO: implement. See README.md.
  return <div>TODO: implement TodoApp</div>;
}
