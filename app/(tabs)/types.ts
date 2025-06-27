// types.ts
export interface Product {
    id: string;
    name: string;
    price: number;
    image: string;
    farmerId: string;
    farmerName: string;
    unit: string;
    createdAt: Date;
}

export interface Shop {
  id: string;
  name: string;
  ownerId: string;
  password: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  createdAt: Date;
}

export interface Order {
    id: string;
    productId: string;
    productName: string;
    farmerId: string;
    customerId: string;
    customerName: string;
    quantity: number;
    status: 'pending' | 'completed';
    createdAt: Date;
}

export interface Customer {
    id: string;
    name: string;
    email: string;
}

export interface Blog {
    id: string;
    title: string;
    content: string;
    authorId: string;
    authorName: string;
    createdAt: Date;
}

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Market: undefined;
  'My Shop': undefined;
  Orders: undefined;
  Blogs: undefined;
  profile: undefined;
  Map: {
    shopId: string;
    readOnly?: boolean;
    initialLocation?: {
      latitude: number;
      longitude: number;
    };
  };
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;