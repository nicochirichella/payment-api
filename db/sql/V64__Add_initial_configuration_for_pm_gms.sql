INSERT INTO payment_method_gateway_methods ( payment_method_id, gateway_method_id, gateway_method_order)
      SELECT id, gateway_method_id, 1
          FROM payment_methods;