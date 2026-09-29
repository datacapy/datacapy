// type MyClassPropertiesFromConstructor = PropsOf<typeof MyClass>;
// type MyClassPropertiesFromInstance = PropsOf<MyClass>;
export type PropsOf<T> = T extends new (...args: any[]) => any
  ? Omit<
      InstanceType<T>,
      {
        [K in keyof InstanceType<T>]: InstanceType<T>[K] extends Function
          ? K
          : never
      }[keyof InstanceType<T>]
    >
  : Omit<
      T,
      {
        [K in keyof T]: T[K] extends Function ? K : never
      }[keyof T]
    >
