import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectMongoDB from '@/app/lib/mongodb';
import User from '@/app/models/User';

// GET endpoint to fetch user addresses
export async function GET(request: Request) {
  try {
    console.log('GET /api/user/addresses - Fetching addresses');
    
    // Get session from cookies
    const cookie = request.headers.get('cookie') || '';
    console.log('Cookie header present:', !!cookie);
    
    const isLoggedIn = cookie.includes('isLoggedIn=true');
    console.log('isLoggedIn cookie found:', isLoggedIn);
    
    if (!isLoggedIn) {
      console.log('User not logged in, returning 401');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - Please log in' 
      }, { 
        status: 401,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        }
      });
    }
    
    // Find the userDataCookie to extract the user ID
    const userDataCookieMatch = cookie.match(/userData=([^;]+)/);
    console.log('userData cookie match found:', !!userDataCookieMatch);
    
    if (!userDataCookieMatch) {
      console.log('No userData cookie found, returning 401');
      return NextResponse.json({ 
        success: false, 
        error: 'User data not found in cookies' 
      }, { status: 401 });
    }
    
    try {
      const userData = JSON.parse(decodeURIComponent(userDataCookieMatch[1]));
      console.log('userData parsed successfully, userId:', userData.userId);
      
      const userId = userData.userId;
      
      if (!userId) {
        console.log('No userId found in userData');
        return NextResponse.json({ 
          success: false, 
          error: 'User ID not found in cookie data' 
        }, { status: 400 });
      }
      
      // Connect to MongoDB
      console.log('Connecting to MongoDB...');
      await connectMongoDB();
      console.log('Connected to MongoDB');
      
      // Find the user and get their addresses
      console.log('Finding user with ID:', userId);
      const user = await User.findById(userId);
      
      if (!user) {
        console.log('User not found with ID:', userId);
        return NextResponse.json({ 
          success: false, 
          error: 'User not found' 
        }, { status: 404 });
      }
      
      console.log('User found, addresses count:', user.addresses?.length || 0);
      return NextResponse.json({
        success: true,
        addresses: user.addresses || []
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        }
      });
    } catch (err) {
      console.error('Error processing user data from cookie:', err);
      // Check if the error is a JSON parse error
      if (err instanceof SyntaxError) {
        console.error('JSON parse error with userData cookie');
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid user data format in cookie' 
        }, { status: 400 });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid user data in cookie' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error fetching addresses:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error' 
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    });
  }
}

// POST endpoint to add a new address
export async function POST(request: Request) {
  try {
    // Get session from cookies
    const cookie = request.headers.get('cookie') || '';
    const isLoggedIn = cookie.includes('isLoggedIn=true');
    
    if (!isLoggedIn) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - Please log in' 
      }, { status: 401 });
    }
    
    // Extract user ID from cookies
    const userDataCookieMatch = cookie.match(/userData=([^;]+)/);
    if (!userDataCookieMatch) {
      return NextResponse.json({ 
        success: false, 
        error: 'User data not found in cookies' 
      }, { status: 401 });
    }
    
    try {
      const userData = JSON.parse(decodeURIComponent(userDataCookieMatch[1]));
      const userId = userData.userId;
      
      // Connect to MongoDB
      await connectMongoDB();
      
      // Parse request body
      const { fullName, phone, addressLine1, addressLine2, city, state, pincode, country, isDefault } = await request.json();
      
      // Validate required fields
      if (!fullName || !phone || !addressLine1 || !city || !state || !pincode || !country) {
        return NextResponse.json({ 
          success: false, 
          error: 'Missing required address fields' 
        }, { status: 400 });
      }
      
      // Find the user
      const user = await User.findById(userId);
      
      if (!user) {
        return NextResponse.json({ 
          success: false, 
          error: 'User not found' 
        }, { status: 404 });
      }
      
      // Create new address
      const newAddress = {
        addressId: new mongoose.Types.ObjectId().toString(),
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        country,
        isDefault: isDefault || false
      };
      
      // If this is set as default, remove default status from other addresses
      if (newAddress.isDefault && user.addresses) {
        user.addresses.forEach((address: any) => {
          address.isDefault = false;
        });
      }
      
      // Add the new address
      if (!user.addresses) {
        user.addresses = [newAddress];
      } else {
        user.addresses.push(newAddress);
      }
      
      // Save user
      await user.save();
      
      return NextResponse.json({
        success: true,
        address: newAddress
      });
    } catch (err) {
      console.error('Error processing user data:', err);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid user data in cookie' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error adding address:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error' 
    }, { status: 500 });
  }
}

// DELETE endpoint to remove an address
export async function DELETE(request: Request) {
  try {
    // Get session from cookies
    const cookie = request.headers.get('cookie') || '';
    const isLoggedIn = cookie.includes('isLoggedIn=true');
    
    if (!isLoggedIn) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - Please log in' 
      }, { status: 401 });
    }
    
    // Extract user ID from cookies
    const userDataCookieMatch = cookie.match(/userData=([^;]+)/);
    if (!userDataCookieMatch) {
      return NextResponse.json({ 
        success: false, 
        error: 'User data not found in cookies' 
      }, { status: 401 });
    }
    
    // Get the addressId from URL params
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const addressId = searchParams.get('addressId');
    
    if (!addressId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Address ID is required' 
      }, { status: 400 });
    }
    
    try {
      const userData = JSON.parse(decodeURIComponent(userDataCookieMatch[1]));
      const userId = userData.userId;
      
      // Connect to MongoDB
      await connectMongoDB();
      
      // Find the user
      const user = await User.findById(userId);
      
      if (!user) {
        return NextResponse.json({ 
          success: false, 
          error: 'User not found' 
        }, { status: 404 });
      }
      
      // Check if user has addresses
      if (!user.addresses || user.addresses.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'No addresses found for this user' 
        }, { status: 404 });
      }
      
      // Check if the address exists
      const addressIndex = user.addresses.findIndex((addr: any) => addr.addressId === addressId);
      
      if (addressIndex === -1) {
        return NextResponse.json({ 
          success: false, 
          error: 'Address not found' 
        }, { status: 404 });
      }
      
      // Check if it's the default address
      const isDefault = user.addresses[addressIndex].isDefault;
      
      // Remove the address
      user.addresses.splice(addressIndex, 1);
      
      // If the deleted address was the default one and there are other addresses left,
      // set the first remaining address as default
      if (isDefault && user.addresses.length > 0) {
        user.addresses[0].isDefault = true;
      }
      
      // Save the user
      await user.save();
      
      return NextResponse.json({
        success: true,
        message: 'Address deleted successfully'
      });
    } catch (err) {
      console.error('Error processing user data:', err);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid user data in cookie' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error deleting address:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error' 
    }, { status: 500 });
  }
}

// PUT endpoint to update an address
export async function PUT(request: Request) {
  try {
    // Get session from cookies
    const cookie = request.headers.get('cookie') || '';
    const isLoggedIn = cookie.includes('isLoggedIn=true');
    
    if (!isLoggedIn) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - Please log in' 
      }, { status: 401 });
    }
    
    // Extract user ID from cookies
    const userDataCookieMatch = cookie.match(/userData=([^;]+)/);
    if (!userDataCookieMatch) {
      return NextResponse.json({ 
        success: false, 
        error: 'User data not found in cookies' 
      }, { status: 401 });
    }
    
    try {
      const userData = JSON.parse(decodeURIComponent(userDataCookieMatch[1]));
      const userId = userData.userId;
      
      // Connect to MongoDB
      await connectMongoDB();
      
      // Parse request body
      const { addressId, fullName, phone, addressLine1, addressLine2, city, state, pincode, country, isDefault } = await request.json();
      
      if (!addressId) {
        return NextResponse.json({ 
          success: false, 
          error: 'Address ID is required' 
        }, { status: 400 });
      }
      
      // Validate required fields
      if (!fullName || !phone || !addressLine1 || !city || !state || !pincode || !country) {
        return NextResponse.json({ 
          success: false, 
          error: 'Missing required address fields' 
        }, { status: 400 });
      }
      
      // Find the user
      const user = await User.findById(userId);
      
      if (!user) {
        return NextResponse.json({ 
          success: false, 
          error: 'User not found' 
        }, { status: 404 });
      }
      
      // Check if user has addresses
      if (!user.addresses || user.addresses.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'No addresses found for this user' 
        }, { status: 404 });
      }
      
      // Find the address to update
      const addressIndex = user.addresses.findIndex((addr: any) => addr.addressId === addressId);
      
      if (addressIndex === -1) {
        return NextResponse.json({ 
          success: false, 
          error: 'Address not found' 
        }, { status: 404 });
      }
      
      // If this address is being set as default, remove default status from other addresses
      if (isDefault && !user.addresses[addressIndex].isDefault) {
        user.addresses.forEach((address: any) => {
          address.isDefault = false;
        });
      }
      
      // Update the address
      user.addresses[addressIndex] = {
        ...user.addresses[addressIndex],
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        country,
        isDefault: isDefault || false
      };
      
      // Save user
      await user.save();
      
      return NextResponse.json({
        success: true,
        address: user.addresses[addressIndex]
      });
    } catch (err) {
      console.error('Error processing user data:', err);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid user data in cookie' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating address:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error' 
    }, { status: 500 });
  }
} 